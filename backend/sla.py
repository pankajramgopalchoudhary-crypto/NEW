"""SLA policies, business hours, cron endpoint, breach notifications.

Design
------
- Policies live in Mongo `sla_policies` (seeded on startup).
- Each ticket gets `first_response_due` and `resolution_due` timestamps at
  creation time (or when priority changes). These are calendar-hour deadlines
  expressed in the business-hour clock defined by the policy — see
  `_add_business_hours()`.
- `POST /api/sla/tick` is the cron endpoint. Hostinger cron hits it every 5-15
  minutes. It walks OPEN + IN_PROGRESS tickets, evaluates state
  (`healthy → warning → at_risk → breached`), and dispatches notifications
  via `notifications.send_and_log_email()` — with dedupe records in
  `sla_events` (unique-composite key prevents double notifications).
"""
from __future__ import annotations
import os
import uuid
import logging
from datetime import datetime, timedelta, time as dtime, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Header
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

try:
    from motor.motor_asyncio import AsyncIOMotorClient  # type: ignore
    _mongo = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
    _db = _mongo[os.environ.get("DB_NAME", "smartsetupuae")]
    _policies = _db["sla_policies"]
    _events = _db["sla_events"]
    _tickets = _db["support_tickets"]
except Exception as e:  # pragma: no cover
    logger.warning("sla mongo init failed: %s", e)
    _policies = _events = _tickets = None


DEFAULT_POLICIES = [
    {
        "_id": "sla-low",
        "priority": "low",
        "first_response_hours": 24,
        "resolution_hours": 72,
        "warning_pct": 50,
        "at_risk_pct": 80,
        "pause_on_pending": True,
    },
    {
        "_id": "sla-medium",
        "priority": "medium",
        "first_response_hours": 8,
        "resolution_hours": 48,
        "warning_pct": 50,
        "at_risk_pct": 80,
        "pause_on_pending": True,
    },
    {
        "_id": "sla-high",
        "priority": "high",
        "first_response_hours": 2,
        "resolution_hours": 12,
        "warning_pct": 50,
        "at_risk_pct": 80,
        "pause_on_pending": True,
    },
    {
        "_id": "sla-urgent",
        "priority": "urgent",
        "first_response_hours": 0.5,
        "resolution_hours": 4,
        "warning_pct": 50,
        "at_risk_pct": 80,
        "pause_on_pending": False,
    },
]

DEFAULT_BUSINESS_HOURS = {
    "timezone": os.environ.get("SUPPORT_TIMEZONE", "Asia/Dubai"),
    "days": [0, 1, 2, 3, 4],   # Mon-Fri (Sun-Thu is UAE norm; can be overridden)
    "start": "09:00",
    "end": "18:00",
    "holidays": [],
}


async def ensure_defaults() -> None:
    if _policies is None:
        return
    try:
        await _events.create_index(
            [("ticket_id", 1), ("type", 1), ("scope", 1)],
            unique=True,
            name="uniq_sla_event"
        )
        await _events.create_index([("at", -1)])
        for p in DEFAULT_POLICIES:
            await _policies.update_one(
                {"_id": p["_id"]},
                {"$setOnInsert": {**p, "business_hours": DEFAULT_BUSINESS_HOURS}},
                upsert=True,
            )
        logger.info("[sla] defaults ensured")
    except Exception as e:
        logger.warning("[sla] ensure_defaults failed: %s", e)


def _parse_time(hhmm: str) -> dtime:
    hh, mm = hhmm.split(":")
    return dtime(int(hh), int(mm))


def _add_business_hours(start: datetime, hours: float, bh: Dict[str, Any]) -> datetime:
    """Advance `start` by `hours` business-hours (skip weekends + non-office hours)."""
    tz = ZoneInfo(bh.get("timezone", "Asia/Dubai"))
    days = set(bh.get("days") or [0, 1, 2, 3, 4])
    day_start = _parse_time(bh.get("start", "09:00"))
    day_end = _parse_time(bh.get("end", "18:00"))
    day_seconds = (
        (datetime.combine(datetime.today(), day_end) -
         datetime.combine(datetime.today(), day_start)).total_seconds()
    )
    remaining = int(hours * 3600)
    cur = start.astimezone(tz)
    guard = 0
    while remaining > 0 and guard < 5000:
        guard += 1
        weekday = cur.weekday()
        if weekday not in days:
            cur = (cur + timedelta(days=1)).replace(
                hour=day_start.hour, minute=day_start.minute, second=0, microsecond=0)
            continue
        window_start = cur.replace(hour=day_start.hour, minute=day_start.minute, second=0, microsecond=0)
        window_end = cur.replace(hour=day_end.hour, minute=day_end.minute, second=0, microsecond=0)
        if cur < window_start:
            cur = window_start
        if cur >= window_end:
            cur = (cur + timedelta(days=1)).replace(
                hour=day_start.hour, minute=day_start.minute, second=0, microsecond=0)
            continue
        avail = int((window_end - cur).total_seconds())
        step = min(avail, remaining)
        cur = cur + timedelta(seconds=step)
        remaining -= step
    return cur.astimezone(timezone.utc)


async def get_policy_for_priority(priority: str) -> Dict[str, Any]:
    p = await _policies.find_one({"priority": priority}) if _policies is not None else None
    if not p:
        # Fallback: use defaults (already inserted, but be safe)
        p = next((x for x in DEFAULT_POLICIES if x["priority"] == priority), DEFAULT_POLICIES[1])
        p["business_hours"] = DEFAULT_BUSINESS_HOURS
    return p


async def compute_deadlines(created_at: datetime, priority: str) -> Dict[str, datetime]:
    p = await get_policy_for_priority(priority)
    bh = p.get("business_hours") or DEFAULT_BUSINESS_HOURS
    return {
        "first_response_due": _add_business_hours(created_at, float(p["first_response_hours"]), bh),
        "resolution_due": _add_business_hours(created_at, float(p["resolution_hours"]), bh),
        "policy_id": p["_id"],
    }


def _sla_state(deadline: datetime, now: datetime, policy: Dict[str, Any],
               window_seconds: int) -> str:
    """Compute state from percent-consumed of the SLA window."""
    if not deadline:
        return "healthy"
    consumed = 1.0 - (deadline - now).total_seconds() / max(window_seconds, 1)
    consumed = max(0.0, min(consumed, 2.0))  # negative = plenty of time; >1 = breached
    warning = float(policy.get("warning_pct", 50)) / 100.0
    at_risk = float(policy.get("at_risk_pct", 80)) / 100.0
    if consumed >= 1.0:
        return "breached"
    if consumed >= at_risk:
        return "at_risk"
    if consumed >= warning:
        return "warning"
    return "healthy"


router = APIRouter(prefix="/api/sla", tags=["sla"])


async def _require_admin(authorization: Optional[str]) -> Dict[str, Any]:
    from auth_utils import is_staff, resolve_caller_role
    caller = await resolve_caller_role(authorization)
    if not is_staff(caller.get("role", "")):
        raise HTTPException(403, "Staff role required")
    return caller


@router.get("/policies")
async def list_policies(authorization: Optional[str] = Header(default=None)):
    await _require_admin(authorization)
    items = []
    async for p in _policies.find():
        items.append(p)
    return {"items": items}


@router.patch("/policies/{policy_id}")
async def update_policy(policy_id: str, patch: Dict[str, Any],
                        authorization: Optional[str] = Header(default=None)):
    await _require_admin(authorization)
    allowed = {"first_response_hours", "resolution_hours",
               "warning_pct", "at_risk_pct", "pause_on_pending", "business_hours"}
    filtered = {k: v for k, v in patch.items() if k in allowed}
    if not filtered:
        raise HTTPException(400, "Nothing to update")
    await _policies.update_one({"_id": policy_id}, {"$set": filtered})
    return {"ok": True}


@router.post("/tick")
async def sla_tick(x_cron_key: Optional[str] = Header(default=None, alias="X-Cron-Key")):
    """Idempotent cron endpoint. Secure with a shared secret so Hostinger cron
    can call it but nobody else can.  Set SLA_CRON_KEY in env."""
    expected = os.environ.get("SLA_CRON_KEY", "")
    if expected and x_cron_key != expected:
        raise HTTPException(401, "Bad cron key")
    if _tickets is None:
        return {"ok": False, "reason": "no db"}

    now = datetime.now(timezone.utc)
    scanned = 0
    warned = 0
    at_risk = 0
    breached = 0

    async for t in _tickets.find({"status": {"$in": ["open", "in_progress"]}}):
        scanned += 1
        priority = t.get("priority", "medium")
        policy = await get_policy_for_priority(priority)

        for scope in ("first_response", "resolution"):
            deadline_iso = t.get(f"{scope}_due")
            done_at = t.get("first_response_at") if scope == "first_response" else t.get("resolved_at")
            if not deadline_iso or done_at:
                continue
            deadline = deadline_iso if isinstance(deadline_iso, datetime) else datetime.fromisoformat(deadline_iso)
            created = t.get("created_at")
            if isinstance(created, str):
                created = datetime.fromisoformat(created)
            window = int((deadline - created).total_seconds())
            state = _sla_state(deadline, now, policy, window)
            if state == "healthy":
                continue

            # Idempotency guard — one event per (ticket, type, scope)
            try:
                await _events.insert_one({
                    "_id": str(uuid.uuid4()),
                    "ticket_id": t["_id"],
                    "type": state,
                    "scope": scope,
                    "at": now.isoformat(),
                })
            except Exception:
                continue  # already logged

            if state == "warning":
                warned += 1
            elif state == "at_risk":
                at_risk += 1
            elif state == "breached":
                breached += 1
                await _tickets.update_one(
                    {"_id": t["_id"]}, {"$set": {"sla_state": "breached"}})

            # Fire an email notification to the assigned agent (if any).
            assigned = t.get("assigned_to")
            if assigned:
                try:
                    from notifications import send_and_log_email
                    subject = f"[SLA {state.upper()}] Ticket {t.get('ticket_number', t['_id'])}"
                    html = (
                        f"<p>Ticket <b>{t.get('ticket_number', t['_id'])}</b> "
                        f"({priority} priority) is <b>{state}</b> on {scope.replace('_', ' ')}.</p>"
                        f"<p>Subject: {t.get('subject', '')}</p>"
                        f"<p><a href='https://admin.smartsetupuae.ae/admin/tickets/{t['_id']}'>Open ticket</a></p>"
                    )
                    await send_and_log_email(
                        to=assigned, subject=subject, html=html,
                        from_alias="support",
                        event_type=f"sla_{state}",
                        ticket_id=t["_id"],
                    )
                except Exception as e:
                    logger.warning("[sla] notify failed for %s: %s", t.get("_id"), e)

    renewals = 0
    try:
        renewals = await _renewal_reminders(now)
    except Exception as e:
        logger.warning("[sla] renewal reminders failed: %s", e)

    return {"ok": True, "scanned": scanned,
            "warned": warned, "at_risk": at_risk, "breached": breached,
            "renewal_tickets": renewals}


# ----------  Renewal reminders (auto-open support tickets before expiry) ----------
import httpx as _httpx  # noqa: E402

RENEWAL_SOURCE_TABLE = os.environ.get("RENEWAL_SOURCE_TABLE", "licenses")
RENEWAL_EXPIRY_FIELD = os.environ.get("RENEWAL_EXPIRY_FIELD", "expiry_date")
RENEWAL_WINDOWS = [30, 14, 3]


async def _open_renewal_ticket(email: str, name: str, license_no: str,
                               expiry_iso: str, days_left: int) -> None:
    """Idempotently create a support ticket + reminder email for a licence renewal."""
    if _tickets is None:
        return
    reminders = _tickets.database["renewal_reminders"]
    dedupe_key = f"{email.lower()}|{license_no}|{days_left}|{expiry_iso}"
    try:
        await reminders.insert_one({"_id": dedupe_key, "at": datetime.now(timezone.utc).isoformat()})
    except Exception:
        return  # already sent this reminder

    tid = uuid.uuid4().hex[:12].upper()
    now_iso = datetime.now(timezone.utc).isoformat()
    counters = _tickets.database["counters"]
    seq_doc = await counters.find_one_and_update(
        {"_id": "support_ticket_seq"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True)
    ticket_number = f"SUP-{(seq_doc or {}).get('seq', 1):06d}"
    subject = f"Licence renewal due in {days_left} days" + (f" — {license_no}" if license_no else "")
    doc = {
        "_id": tid, "ticket_number": ticket_number, "reference": ticket_number,
        "subject": subject, "channel": "system", "priority": "high" if days_left <= 3 else "medium",
        "category": "compliance", "status": "open",
        "customer_email": (email or "").lower(), "customer_name": name or "",
        "phone": "", "related_url": "", "assigned_to": "", "supabase_user_id": "",
        "created_at": now_iso, "updated_at": now_iso,
        "first_response_at": "", "resolved_at": "", "sla_state": "healthy",
        "sla_policy_id": None, "first_response_due": None, "resolution_due": None,
        "sla_paused_at": None, "total_paused_seconds": 0,
        "ai_status": "none", "ai_confidence": None, "requires_human": False,
        "renewal": {"license_number": license_no, "expiry_date": expiry_iso, "days_left": days_left},
    }
    await _tickets.insert_one(doc)
    await _tickets.database["support_messages"].insert_one({
        "ticket_id": tid, "from_role": "system", "from_email": "system@smartsetupuae.ae",
        "body": (f"Your licence {license_no or ''} expires on {expiry_iso} "
                 f"({days_left} days away). Renew before expiry to avoid fines. "
                 f"Reply here and an advisor will assist with your renewal."),
        "attachments": [], "created_at": now_iso,
    })
    try:
        from notifications import send_and_log_email
        if email:
            html = (
                f"<p>Hi {name or 'there'},</p>"
                f"<p>Your UAE licence <b>{license_no or ''}</b> expires on <b>{expiry_iso}</b> "
                f"— that's <b>{days_left} days</b> away.</p>"
                f"<p>We've opened renewal ticket <b>{ticket_number}</b> for you. "
                f"Renewing early avoids fines and visa disruptions.</p>"
                f"<p><a href='https://smartsetupuae.ae/dashboard/support/{tid}'>Track your renewal</a></p>"
                f"<p>— SmartSetupUAE Support</p>"
            )
            await send_and_log_email(
                to=email, subject=f"[{ticket_number}] Licence renewal due in {days_left} days",
                html=html, from_alias="support", event_type="renewal_reminder",
                template="renewal_reminder", ticket_id=tid,
            )
    except Exception as e:
        logger.warning("[sla] renewal email failed: %s", e)


async def _renewal_reminders(now: datetime) -> int:
    """Scan the licence source table in Supabase and open reminder tickets at 30/14/3 days."""
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not (url and key):
        return 0
    horizon = (now + timedelta(days=max(RENEWAL_WINDOWS) + 1)).date().isoformat()
    today = now.date().isoformat()
    created = 0
    try:
        async with _httpx.AsyncClient(timeout=12) as c:
            r = await c.get(
                f"{url}/rest/v1/{RENEWAL_SOURCE_TABLE}",
                params={
                    "select": "*",
                    RENEWAL_EXPIRY_FIELD: f"gte.{today}",
                    "order": f"{RENEWAL_EXPIRY_FIELD}.asc",
                    "limit": "1000",
                },
                headers={"apikey": key, "Authorization": f"Bearer {key}"},
            )
            if r.status_code >= 400:
                logger.info("[sla] renewal source '%s' unavailable (%s) — skipping",
                            RENEWAL_SOURCE_TABLE, r.status_code)
                return 0
            rows = r.json() or []
    except Exception as e:
        logger.info("[sla] renewal scan skipped: %s", e)
        return 0

    for row in rows:
        exp_raw = row.get(RENEWAL_EXPIRY_FIELD)
        exp = None
        try:
            exp = datetime.fromisoformat(str(exp_raw).replace("Z", "+00:00").split("T")[0])
        except Exception:
            continue
        days_left = (exp.date() - now.date()).days
        if days_left not in RENEWAL_WINDOWS:
            continue
        email = row.get("customer_email") or row.get("email") or ""
        name = row.get("customer_name") or row.get("name") or ""
        license_no = str(row.get("license_number") or row.get("licence_number") or row.get("id") or "")
        if not email:
            continue
        await _open_renewal_ticket(email, name, license_no, exp.date().isoformat(), days_left)
        created += 1
    return created
