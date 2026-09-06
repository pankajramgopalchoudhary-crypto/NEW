"""Support tickets — Aria-first, live-agent-second.

Flow:
  1. Customer raises a ticket from Aria chatbot, dashboard, or any page.
  2. Aria attempts an instant AI reply (saved as first message in the thread).
  3. Ticket appears in admin panel for all staff. Whoever clicks "Claim"
     becomes the assigned agent. SLA timer (30 min) starts ticking.
  4. Agent + customer exchange messages until status is set to "resolved".

Endpoints:
  POST   /api/support/tickets                 → create ticket (open + Aria first-reply)
  GET    /api/support/tickets                 → admin list (filter by status, mine)
  GET    /api/support/tickets/{id}            → one ticket + messages
  POST   /api/support/tickets/{id}/messages   → add a reply
  POST   /api/support/tickets/{id}/claim      → assign to caller
  PATCH  /api/support/tickets/{id}            → update status / priority
  GET    /api/support/tickets/by-user/{email} → customer-visible list
"""
from __future__ import annotations
import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
import httpx
from auth_utils import is_staff, resolve_caller_role

logger = logging.getLogger(__name__)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

router = APIRouter(prefix="/api/support", tags=["support"])

try:
    from motor.motor_asyncio import AsyncIOMotorClient
    _mongo = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    _db = _mongo[os.environ.get("DB_NAME", "smartsetupuae")]
    _tickets = _db["support_tickets"]
    _messages = _db["support_messages"]
except Exception as _exc:
    _tickets = _messages = None
    logger.warning("Support tickets disabled — Mongo not available: %s", _exc)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


_resolve_caller_role = resolve_caller_role
_is_staff = is_staff


# ----------  Aria first-reply (best-effort) ----------
async def _aria_first_reply(subject: str, message: str) -> str:
    """Quick AI acknowledgement so the customer hears something instantly."""
    if not EMERGENT_LLM_KEY:
        return ""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage  # type: ignore
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"ticket-{uuid.uuid4().hex[:8]}",
            system_message=(
                "You are Aria, SmartSetupUAE's AI concierge. A customer has opened a support ticket. "
                "Reply in 2–4 short sentences: (1) acknowledge politely, (2) give an immediate helpful "
                "answer if you can (UAE business setup, freezone, visa, VAT, banking) using the public "
                "information from smartsetupuae.ae, (3) tell them a human advisor will reach them on "
                "WhatsApp +971 58 590 3155 within 30 minutes. Sign off as 'Aria'."
            ),
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        out = await chat.send_message(UserMessage(text=f"Subject: {subject}\n\nMessage: {message}"))
        return (out or "").strip()
    except Exception as exc:
        logger.warning("Aria first-reply failed: %s", exc)
        return ""


# ----------  Models ----------
class TicketIn(BaseModel):
    subject: str
    message: str
    customer_email: Optional[str] = None
    customer_name: Optional[str] = None
    phone: Optional[str] = None
    channel: Optional[str] = "web"   # web | aria | whatsapp | email
    priority: Optional[str] = "medium"  # low | medium | high | urgent
    category: Optional[str] = "general"  # general|technical|account|payment|visa|compliance|sales|foundersclub|other
    related_url: Optional[str] = None


class MessageIn(BaseModel):
    body: str
    attachments: Optional[List[Dict[str, Any]]] = None


class TicketPatch(BaseModel):
    status: Optional[str] = None        # open | in_progress | resolved | closed
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    internal_note: Optional[str] = None


def _ticket_doc(doc):
    """Serialize a Mongo doc for the API — strips `_id` (which is a UUID
    string here) and any accidental ObjectId. Returns None for missing doc."""
    if not doc:
        return None
    out = {k: v for k, v in doc.items() if k != "_id"}
    out["id"] = str(doc.get("_id")) if doc.get("_id") is not None else None
    return out

# ----------  Endpoints ----------
async def _next_ticket_number() -> str:
    """Atomic SUP-#### counter — reuses the `counters` collection."""
    if _tickets is None:
        return "SUP-000000"
    from motor.motor_asyncio import AsyncIOMotorClient  # noqa: F401
    counters = _tickets.database["counters"]
    res = await counters.find_one_and_update(
        {"_id": "support_ticket_seq"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = (res or {}).get("seq", 1)
    return f"SUP-{seq:06d}"


async def _broadcast_ticket(ticket_id: str, event: str, payload: Dict[str, Any]) -> None:
    """Broadcast a ticket update via Supabase Realtime channel.
    Silent-fail so ticket write never depends on realtime uptime."""
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not (url and key):
        return
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            await c.post(
                f"{url}/realtime/v1/api/broadcast",
                headers={"apikey": key, "Authorization": f"Bearer {key}",
                         "Content-Type": "application/json"},
                json={"messages": [{
                    "topic": f"ticket:{ticket_id}",
                    "event": event,
                    "payload": payload,
                }]},
            )
    except Exception:
        pass


@router.post("/tickets")
async def create_ticket(body: TicketIn, authorization: Optional[str] = Header(default=None)):
    if _tickets is None:
        raise HTTPException(500, "Tickets backend not available.")
    caller = await _resolve_caller_role(authorization)
    tid = uuid.uuid4().hex[:12].upper()
    ticket_number = await _next_ticket_number()
    now = _now()

    # Compute SLA deadlines (business hours aware).
    from sla import compute_deadlines
    from datetime import datetime as _dt
    try:
        deadlines = await compute_deadlines(_dt.fromisoformat(now), body.priority or "medium")
    except Exception:
        deadlines = {"first_response_due": None, "resolution_due": None, "policy_id": None}

    doc = {
        "_id": tid,
        "ticket_number": ticket_number,
        "reference": ticket_number,       # legacy alias kept for older clients
        "subject": body.subject[:200],
        "channel": body.channel or "web",
        "priority": body.priority or "medium",
        "category": getattr(body, "category", None) or "general",
        "status": "open",
        "customer_email": (body.customer_email or caller.get("email") or "").lower(),
        "customer_name": body.customer_name or "",
        "phone": body.phone or "",
        "related_url": body.related_url or "",
        "assigned_to": "",
        "supabase_user_id": caller.get("id") or "",
        "created_at": now,
        "updated_at": now,
        "first_response_at": "",
        "resolved_at": "",
        "sla_state": "healthy",
        "sla_policy_id": deadlines.get("policy_id"),
        "first_response_due": deadlines["first_response_due"].isoformat() if deadlines.get("first_response_due") else None,
        "resolution_due": deadlines["resolution_due"].isoformat() if deadlines.get("resolution_due") else None,
        "sla_paused_at": None,
        "total_paused_seconds": 0,
        "ai_status": "none",
        "ai_confidence": None,
        "requires_human": False,
    }
    await _tickets.insert_one(doc)
    # First customer message
    await _messages.insert_one({
        "ticket_id": tid,
        "from_role": "customer",
        "from_email": doc["customer_email"],
        "body": body.message[:4000],
        "created_at": now,
    })

    # AI suggestion (SUGGEST_ONLY by default → stored on the ticket for the
    # agent to review; auto-reply is gated inside ai_support.suggest_reply).
    try:
        from ai_support import suggest_reply, get_config as _ai_cfg
        cfg = await _ai_cfg()
        suggestion = await suggest_reply(
            subject=body.subject, latest_message=body.message,
            ticket_id=tid, history=[],
            priority=doc.get("priority", "medium"),
            ticket_category=doc.get("category"),
        )
        await _tickets.update_one({"_id": tid}, {"$set": {
            "ai_status": "suggested" if suggestion.get("action") == "suggested" else suggestion.get("action"),
            "ai_confidence": suggestion.get("confidence"),
            "requires_human": suggestion.get("requires_human", False),
            "ai_suggestion": suggestion.get("reply"),
        }})
        # AUTO_REPLY path — only if all guardrails cleared inside suggest_reply
        if cfg.get("mode") == "AUTO_REPLY" and suggestion.get("action") == "auto_reply_eligible":
            await _messages.insert_one({
                "ticket_id": tid,
                "from_role": "aria",
                "from_email": "aria@smartsetupuae.ae",
                "body": (suggestion.get("reply") or "")[:4000],
                "created_at": _now(),
            })
            auto_set = {"first_response_at": _now(), "ai_status": "auto_replied"}
            if cfg.get("auto_resolve", True):
                auto_set["status"] = "resolved"
                auto_set["resolved_at"] = _now()
            await _tickets.update_one({"_id": tid}, {"$set": auto_set})
    except Exception as _e:
        logger.warning("[support] AI suggestion failed for %s: %s", tid, _e)

    # Confirmation email to customer (with ticket_id linked in email_logs).
    try:
        from notifications import send_and_log_email
        html = (
            f"<p>Hi {doc['customer_name'] or 'there'},</p>"
            f"<p>We've received your request. Your ticket reference is "
            f"<b>{ticket_number}</b>.</p>"
            f"<p>Subject: {doc['subject']}</p>"
            f"<p>You'll receive an update from our team shortly. You can "
            f"track this ticket at "
            f"<a href='https://smartsetupuae.ae/dashboard/support/{tid}'>your support portal</a>.</p>"
            f"<p>— SmartSetupUAE Support</p>"
        )
        if doc["customer_email"]:
            await send_and_log_email(
                to=doc["customer_email"],
                subject=f"[{ticket_number}] We received your request",
                html=html,
                from_alias="support",
                event_type="ticket_created",
                template="ticket_created",
                supabase_user_id=doc["supabase_user_id"] or None,
                ticket_id=tid,
            )
    except Exception as _e:
        logger.warning("[support] ticket-created email failed: %s", _e)

    fresh = await _tickets.find_one({"_id": tid})
    payload = _ticket_doc(fresh)
    await _broadcast_ticket(tid, "created", payload or {})
    return {"ok": True, "ticket": payload}


@router.get("/tickets")
async def list_tickets(
    status: Optional[str] = None,
    mine: Optional[bool] = False,
    authorization: Optional[str] = Header(default=None),
):
    if _tickets is None:
        raise HTTPException(500, "Tickets backend not available.")
    caller = await _resolve_caller_role(authorization)
    if not _is_staff(caller["role"]):
        raise HTTPException(403, "Staff role required")
    q: Dict[str, Any] = {}
    if status:
        q["status"] = status
    if mine and caller.get("email"):
        q["assigned_to"] = caller["email"].lower()
    cursor = _tickets.find(q).sort("created_at", -1).limit(200)
    rows = [doc async for doc in cursor]
    return rows


@router.get("/tickets/{tid}")
async def one_ticket(tid: str, authorization: Optional[str] = Header(default=None)):
    if _tickets is None:
        raise HTTPException(500, "Tickets backend not available.")
    caller = await _resolve_caller_role(authorization)
    t = await _tickets.find_one({"_id": tid})
    if not t:
        raise HTTPException(404, "Ticket not found")
    # Customer can only see their own; staff can see any.
    if not _is_staff(caller["role"]) and t.get("customer_email", "").lower() != caller.get("email", "").lower():
        raise HTTPException(403, "Not your ticket")
    msgs = []
    async for m in _messages.find({"ticket_id": tid}).sort("created_at", 1):
        m.pop("_id", None)
        msgs.append(m)
    return {"ticket": _ticket_doc(t), "messages": msgs}


@router.post("/tickets/{tid}/messages")
async def add_message(tid: str, body: MessageIn, authorization: Optional[str] = Header(default=None)):
    if _tickets is None:
        raise HTTPException(500, "Tickets backend not available.")
    caller = await _resolve_caller_role(authorization)
    t = await _tickets.find_one({"_id": tid})
    if not t:
        raise HTTPException(404, "Ticket not found")
    is_staff = _is_staff(caller["role"])
    is_owner = t.get("customer_email", "").lower() == caller.get("email", "").lower()
    if not is_staff and not is_owner:
        raise HTTPException(403, "Not allowed")
    msg = {
        "ticket_id": tid,
        "from_role": "agent" if is_staff else "customer",
        "from_email": caller.get("email", "anonymous"),
        "body": body.body[:4000],
        "attachments": body.attachments or [],
        "created_at": _now(),
    }
    await _messages.insert_one(msg)
    msg.pop("_id", None)
    update: Dict[str, Any] = {"updated_at": _now()}
    if is_staff and not t.get("first_response_at"):
        update["first_response_at"] = _now()
    if is_staff and t.get("status") == "open":
        update["status"] = "in_progress"
    await _tickets.update_one({"_id": tid}, {"$set": update})

    # Notify the OTHER party (agent → customer, or customer → assigned agent).
    try:
        from notifications import send_and_log_email
        ticket_number = t.get("ticket_number") or t.get("reference") or tid
        subject_email = f"[{ticket_number}] New reply on your ticket"
        if is_staff:
            # Notify customer
            recipient = t.get("customer_email") or ""
            if recipient:
                html = (
                    f"<p>Hi {t.get('customer_name') or 'there'},</p>"
                    f"<p>Our support team replied to your ticket "
                    f"<b>{ticket_number}</b>.</p>"
                    f"<blockquote>{body.body[:600]}</blockquote>"
                    f"<p><a href='https://smartsetupuae.ae/dashboard/support/{tid}'>Open the ticket</a></p>"
                )
                await send_and_log_email(
                    to=recipient, subject=subject_email, html=html,
                    from_alias="support",
                    event_type="ticket_reply",
                    template="ticket_agent_reply",
                    supabase_user_id=t.get("supabase_user_id"),
                    ticket_id=tid,
                )
        else:
            # Notify assigned agent
            recipient = t.get("assigned_to") or ""
            if recipient:
                html = (
                    f"<p>The customer replied on ticket <b>{ticket_number}</b>.</p>"
                    f"<blockquote>{body.body[:600]}</blockquote>"
                    f"<p><a href='https://admin.smartsetupuae.ae/admin/tickets/{tid}'>Open in admin</a></p>"
                )
                await send_and_log_email(
                    to=recipient,
                    subject=f"[{ticket_number}] Customer replied",
                    html=html,
                    from_alias="support",
                    event_type="ticket_reply",
                    template="ticket_customer_reply",
                    ticket_id=tid,
                )
    except Exception as _e:
        logger.warning("[support] reply notification failed: %s", _e)

    await _broadcast_ticket(tid, "message_added", {"message": msg})
    return {"ok": True, "message": msg}


@router.post("/tickets/{tid}/claim")
async def claim_ticket(tid: str, authorization: Optional[str] = Header(default=None)):
    if _tickets is None:
        raise HTTPException(500, "Tickets backend not available.")
    caller = await _resolve_caller_role(authorization)
    if not _is_staff(caller["role"]):
        raise HTTPException(403, "Staff role required")
    t = await _tickets.find_one({"_id": tid})
    if not t:
        raise HTTPException(404, "Ticket not found")
    if t.get("assigned_to") and t["assigned_to"] != caller["email"]:
        raise HTTPException(409, f"Already assigned to {t['assigned_to']}")
    await _tickets.update_one({"_id": tid}, {"$set": {
        "assigned_to": caller["email"].lower(),
        "status": "in_progress" if t.get("status") == "open" else t.get("status"),
        "updated_at": _now(),
    }})
    fresh = await _tickets.find_one({"_id": tid})
    return {"ok": True, "ticket": _ticket_doc(fresh)}


@router.patch("/tickets/{tid}")
async def patch_ticket(tid: str, body: TicketPatch, authorization: Optional[str] = Header(default=None)):
    if _tickets is None:
        raise HTTPException(500, "Tickets backend not available.")
    caller = await _resolve_caller_role(authorization)
    if not _is_staff(caller["role"]):
        raise HTTPException(403, "Staff role required")
    payload: Dict[str, Any] = {"updated_at": _now()}
    if body.status:
        payload["status"] = body.status
        if body.status in ("resolved", "closed"):
            payload["resolved_at"] = _now()
    if body.priority:
        payload["priority"] = body.priority
    if body.assigned_to is not None:
        payload["assigned_to"] = body.assigned_to.lower()
    if body.internal_note:
        await _messages.insert_one({
            "ticket_id": tid,
            "from_role": "internal",
            "from_email": caller.get("email", ""),
            "body": body.internal_note[:4000],
            "created_at": _now(),
        })
    await _tickets.update_one({"_id": tid}, {"$set": payload})
    fresh = await _tickets.find_one({"_id": tid})
    return {"ok": True, "ticket": _ticket_doc(fresh)}


@router.get("/tickets/by-user/{email}")
async def list_for_user(email: str, authorization: Optional[str] = Header(default=None)):
    if _tickets is None:
        raise HTTPException(500, "Tickets backend not available.")
    caller = await _resolve_caller_role(authorization)
    if not (_is_staff(caller["role"]) or caller.get("email", "").lower() == email.lower()):
        raise HTTPException(403, "Not allowed")
    cursor = _tickets.find({"customer_email": email.lower()}).sort("created_at", -1).limit(50)
    rows = [doc async for doc in cursor]
    return {"tickets": [_ticket_doc(r) for r in rows]}


# ----------  Attachments (Supabase Storage, signed URLs) ----------
SUPPORT_BUCKET = os.environ.get("SUPPORT_ATTACHMENTS_BUCKET", "support-attachments")
# Must stay in sync with the Supabase bucket's allowed_mime_types, otherwise
# the browser PUT fails after we have already handed out a signed URL.
ALLOWED_MIME = {
    "image/png", "image/jpeg", "image/webp",
    "application/pdf",
}
MAX_ATTACHMENT_BYTES = int(os.environ.get("SUPPORT_ATTACHMENT_MAX_BYTES", str(10 * 1024 * 1024)))


class SignUploadIn(BaseModel):
    filename: str
    content_type: str
    size: int


class SignDownloadIn(BaseModel):
    path: str


async def _ticket_or_403(tid: str, authorization: Optional[str]) -> Dict[str, Any]:
    caller = await _resolve_caller_role(authorization)
    t = await _tickets.find_one({"_id": tid})
    if not t:
        raise HTTPException(404, "Ticket not found")
    is_owner = t.get("customer_email", "").lower() == caller.get("email", "").lower()
    if not (_is_staff(caller["role"]) or is_owner):
        raise HTTPException(403, "Not allowed")
    return t


@router.post("/tickets/{tid}/attachments/sign-upload")
async def sign_upload(tid: str, body: SignUploadIn, authorization: Optional[str] = Header(default=None)):
    """Validate the file then return a Supabase signed-upload URL the browser can PUT to."""
    if not (SUPABASE_URL and SUPABASE_SERVICE_KEY):
        raise HTTPException(500, "Storage not configured.")
    await _ticket_or_403(tid, authorization)
    ct = (body.content_type or "").lower().split(";")[0].strip()
    if ct not in ALLOWED_MIME:
        raise HTTPException(400, f"File type '{ct}' not allowed.")
    if body.size <= 0 or body.size > MAX_ATTACHMENT_BYTES:
        raise HTTPException(400, f"File too large. Max {MAX_ATTACHMENT_BYTES // (1024*1024)} MB.")
    import re as _re
    safe = _re.sub(r"[^a-zA-Z0-9._-]", "_", body.filename or "file")[:120]
    path = f"tickets/{tid}/{uuid.uuid4().hex[:8]}-{safe}"
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(
                f"{SUPABASE_URL}/storage/v1/object/upload/sign/{SUPPORT_BUCKET}/{path}",
                headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"},
            )
            if r.status_code >= 400:
                raise HTTPException(r.status_code, f"Storage sign failed: {r.text[:200]}")
            signed = r.json() or {}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc))
    token_path = signed.get("url") or f"/object/upload/sign/{SUPPORT_BUCKET}/{path}"
    return {
        "bucket": SUPPORT_BUCKET,
        "path": path,
        "upload_url": f"{SUPABASE_URL}/storage/v1{token_path}",
        "content_type": ct,
    }


@router.post("/tickets/{tid}/attachments/sign-download")
async def sign_download(tid: str, body: SignDownloadIn, authorization: Optional[str] = Header(default=None)):
    """Return a short-lived signed URL to view/download a stored attachment."""
    if not (SUPABASE_URL and SUPABASE_SERVICE_KEY):
        raise HTTPException(500, "Storage not configured.")
    await _ticket_or_403(tid, authorization)
    if not body.path.startswith(f"tickets/{tid}/"):
        raise HTTPException(403, "Path does not belong to this ticket.")
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(
                f"{SUPABASE_URL}/storage/v1/object/sign/{SUPPORT_BUCKET}/{body.path}",
                headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                         "Content-Type": "application/json"},
                json={"expiresIn": 3600},
            )
            if r.status_code >= 400:
                raise HTTPException(r.status_code, f"Storage sign failed: {r.text[:200]}")
            data = r.json() or {}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc))
    return {"signed_url": f"{SUPABASE_URL}/storage/v1{data.get('signedURL', '')}"}


# ----------  Support analytics ----------
def _parse_iso(v):
    from datetime import datetime as _dt
    if not v:
        return None
    if isinstance(v, _dt):
        return v
    try:
        return _dt.fromisoformat(str(v).replace("Z", "+00:00"))
    except Exception:
        return None


@router.get("/analytics")
async def support_analytics(days: int = 30, authorization: Optional[str] = Header(default=None)):
    """Resolution time, SLA compliance %, AI resolution + escalation rates for a window."""
    if _tickets is None:
        raise HTTPException(500, "Tickets backend not available.")
    caller = await _resolve_caller_role(authorization)
    if not _is_staff(caller["role"]):
        raise HTTPException(403, "Staff role required")
    from datetime import timedelta
    days = max(1, min(int(days or 30), 365))
    since = datetime.now(timezone.utc) - timedelta(days=days)
    since_iso = since.isoformat()

    total = resolved = breached = compliant = ai_resolved = escalated = 0
    res_secs: List[float] = []
    fr_secs: List[float] = []
    by_category: Dict[str, int] = {}
    by_status: Dict[str, int] = {}

    async for t in _tickets.find({"created_at": {"$gte": since_iso}}):
        total += 1
        st = t.get("status", "open")
        by_status[st] = by_status.get(st, 0) + 1
        cat = t.get("category", "general")
        by_category[cat] = by_category.get(cat, 0) + 1
        created = _parse_iso(t.get("created_at"))
        fr = _parse_iso(t.get("first_response_at"))
        if created and fr:
            fr_secs.append((fr - created).total_seconds())
        rat = _parse_iso(t.get("resolved_at"))
        if rat:
            resolved += 1
            if created:
                res_secs.append((rat - created).total_seconds())
            due = _parse_iso(t.get("resolution_due"))
            if t.get("sla_state") == "breached" or (due and rat > due):
                breached += 1
            else:
                compliant += 1
        if t.get("ai_status") in ("auto_replied",):
            ai_resolved += 1
        if t.get("requires_human"):
            escalated += 1

    # AI log breakdown for the same window
    logs = _tickets.database["ai_support_logs"]
    ai_total = ai_auto = ai_suggested = ai_escalated = 0
    try:
        async for lg in logs.find({"created_at": {"$gte": since_iso}}):
            ai_total += 1
            action = lg.get("action", "")
            if action == "auto_reply_eligible":
                ai_auto += 1
            elif action == "suggested":
                ai_suggested += 1
            elif action and action.startswith("escalated"):
                ai_escalated += 1
            if lg.get("requires_human"):
                ai_escalated += 0  # already counted via action for escalations
    except Exception:
        pass

    def _avg(lst):
        return round(sum(lst) / len(lst) / 3600.0, 2) if lst else 0.0

    return {
        "window_days": days,
        "totals": {"total": total, "resolved": resolved, "open": total - resolved,
                   "by_status": by_status, "by_category": by_category},
        "resolution": {
            "avg_hours": _avg(res_secs),
            "avg_first_response_hours": _avg(fr_secs),
            "resolved_count": resolved,
        },
        "sla": {
            "compliant": compliant,
            "breached": breached,
            "compliance_pct": round(compliant / resolved * 100, 1) if resolved else 100.0,
        },
        "ai": {
            "suggestions_total": ai_total,
            "auto_replied": ai_auto,
            "suggested_only": ai_suggested,
            "escalated": ai_escalated,
            "ai_resolution_rate_pct": round(ai_auto / ai_total * 100, 1) if ai_total else 0.0,
            "escalation_rate_pct": round(ai_escalated / ai_total * 100, 1) if ai_total else 0.0,
        },
    }
