"""Central email logs — single source of truth for outgoing mail.

Every outgoing email in the whole platform passes through `log_email()`
before hitting Resend, so we have a durable audit trail and the Resend
webhook can update statuses in place.

Design principles
-----------------
1. `log_email()` is called with `status="queued"` BEFORE the Resend API call.
2. On the Resend response we set `status="sent"` + `provider_message_id`
   (or `status="failed"` + `error` if the API rejected it).
3. Real delivery status only lands via the Resend webhook (`webhooks_resend.py`),
   which flips `sent → delivered/bounced/…`.
4. Never store PII beyond what's already in the email (no OTP codes, no
   reset tokens, no passwords, no API keys).
"""
from __future__ import annotations
import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Header, Query
from auth_utils import is_staff, resolve_caller_role

logger = logging.getLogger(__name__)

# --- Mongo lazy singleton (reuses backend connection pool) --------------------
try:
    from motor.motor_asyncio import AsyncIOMotorClient  # type: ignore
    _mongo = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    _db = _mongo[os.environ.get("DB_NAME", "smartsetupuae")]
    _logs = _db["email_logs"]
    _webhook = _db["resend_webhook_events"]
except Exception as e:  # pragma: no cover
    logger.warning("email_logs mongo init failed: %s", e)
    _logs = None
    _webhook = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def ensure_indexes() -> None:
    """Idempotent index creation — called on backend startup."""
    if _logs is None:
        return
    try:
        await _logs.create_index("provider_message_id", unique=True, sparse=True)
        await _logs.create_index([("ticket_id", 1), ("created_at", -1)])
        await _logs.create_index([("supabase_user_id", 1), ("created_at", -1)])
        await _logs.create_index([("status", 1), ("created_at", -1)])
        # TTL: keep 365 days of email history
        await _logs.create_index("created_at_dt", expireAfterSeconds=365 * 24 * 3600)
        if _webhook is not None:
            await _webhook.create_index("event_id", unique=True)
            await _webhook.create_index([("processed_at", -1)])
        logger.info("[email_logs] indexes ensured")
    except Exception as e:
        logger.warning("[email_logs] index create failed: %s", e)


ALLOWED_ALIASES = {
    "noreply": "noreply@smartsetupuae.ae",
    "account": "account@smartsetupuae.ae",
    "support": "support@smartsetupuae.ae",
    "sales": "sales@smartsetupuae.ae",
    "visa": "visa@smartsetupuae.ae",
    "compliance": "compliance@smartsetupuae.ae",
    "foundersclub": "foundersclub@smartsetupuae.ae",
    "careers": "career@smartsetupuae.ae",
}


async def log_email(
    *,
    event_type: str,
    to: str,
    subject: str,
    from_alias: str = "noreply",
    template: Optional[str] = None,
    supabase_user_id: Optional[str] = None,
    ticket_id: Optional[str] = None,
    order_id: Optional[str] = None,
    cc: Optional[List[str]] = None,
) -> str:
    """Insert a `queued` row and return the internal id (used by the sender to
    update `sent`/`failed`)."""
    if _logs is None:
        return ""
    doc = {
        "_id": str(uuid.uuid4()),
        "event_type": event_type,
        "supabase_user_id": supabase_user_id,
        "ticket_id": ticket_id,
        "order_id": order_id,
        "from_alias": from_alias,
        "from_email": ALLOWED_ALIASES.get(from_alias, "noreply@smartsetupuae.ae"),
        "to": to,
        "cc": cc or [],
        "subject": subject,
        "template": template,
        "provider": "resend",
        "provider_message_id": None,
        "status": "queued",
        "error": None,
        "created_at": _now(),
        "created_at_dt": datetime.now(timezone.utc),
    }
    await _logs.insert_one(doc)
    return doc["_id"]


async def mark_sent(log_id: str, provider_message_id: str) -> None:
    if _logs is None or not log_id:
        return
    await _logs.update_one(
        {"_id": log_id},
        {"$set": {
            "provider_message_id": provider_message_id,
            "status": "sent",
            "sent_at": _now(),
        }},
    )


async def mark_failed(log_id: str, error: str) -> None:
    if _logs is None or not log_id:
        return
    await _logs.update_one(
        {"_id": log_id},
        {"$set": {"status": "failed", "error": error[:2000]}},
    )


async def update_status_by_provider_id(
    provider_message_id: str, status: str, event_time: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> bool:
    """Called from Resend webhook. Idempotent — only advances forward."""
    if _logs is None:
        return False
    valid = {
        "sent", "delivered", "delivery_delayed", "bounced",
        "failed", "complained", "opened", "clicked",
    }
    if status not in valid:
        return False
    time_key_map = {
        "sent": "sent_at",
        "delivered": "delivered_at",
        "delivery_delayed": "delayed_at",
        "bounced": "bounced_at",
        "failed": "failed_at",
        "complained": "complained_at",
        "opened": "opened_at",
        "clicked": "clicked_at",
    }
    set_fields: Dict[str, Any] = {"status": status}
    set_fields[time_key_map[status]] = event_time or _now()
    if extra:
        set_fields["last_event_meta"] = extra
    res = await _logs.update_one(
        {"provider_message_id": provider_message_id},
        {"$set": set_fields},
    )
    return res.modified_count > 0


# ------------------------------------------------------------------ Admin API
router = APIRouter(prefix="/api/admin/email-logs", tags=["email-logs"])

# Lazy import of role resolver to avoid circulars
async def _require_staff(authorization: Optional[str]) -> Dict[str, Any]:
    caller = await resolve_caller_role(authorization)
    if not is_staff(caller.get("role", "")):
        raise HTTPException(403, "Staff role required")
    return caller


@router.get("")
async def list_logs(
    status: Optional[str] = Query(None),
    from_alias: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    authorization: Optional[str] = Header(default=None),
):
    await _require_staff(authorization)
    if _logs is None:
        raise HTTPException(500, "email_logs backend not available")
    query: Dict[str, Any] = {}
    if status:
        query["status"] = status
    if from_alias:
        query["from_alias"] = from_alias
    if q:
        query["$or"] = [
            {"to": {"$regex": q, "$options": "i"}},
            {"subject": {"$regex": q, "$options": "i"}},
        ]
    total = await _logs.count_documents(query)
    items = []
    cursor = _logs.find(query).sort("created_at", -1).skip(skip).limit(limit)
    async for d in cursor:
        d.pop("created_at_dt", None)
        d["id"] = d.pop("_id")
        items.append(d)
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.get("/stats")
async def stats(
    days: int = Query(7, ge=1, le=90),
    authorization: Optional[str] = Header(default=None),
):
    await _require_staff(authorization)
    if _logs is None:
        raise HTTPException(500, "email_logs backend not available")
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    pipeline = [
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    by_status = {r["_id"]: r["count"] async for r in _logs.aggregate(pipeline)}
    total = sum(by_status.values())
    return {
        "days": days,
        "total": total,
        "sent": by_status.get("sent", 0),
        "delivered": by_status.get("delivered", 0),
        "delivery_delayed": by_status.get("delivery_delayed", 0),
        "bounced": by_status.get("bounced", 0),
        "failed": by_status.get("failed", 0),
        "complained": by_status.get("complained", 0),
        "opened": by_status.get("opened", 0),
        "clicked": by_status.get("clicked", 0),
        "queued": by_status.get("queued", 0),
    }


@router.get("/{log_id}")
async def get_log(log_id: str, authorization: Optional[str] = Header(default=None)):
    await _require_staff(authorization)
    if _logs is None:
        raise HTTPException(500, "email_logs backend not available")
    d = await _logs.find_one({"_id": log_id})
    if not d:
        raise HTTPException(404, "Not found")
    d.pop("created_at_dt", None)
    d["id"] = d.pop("_id")
    return d
