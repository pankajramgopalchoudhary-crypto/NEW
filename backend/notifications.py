"""Notifications — WhatsApp (Meta Cloud API) + Email (Resend).

Every outgoing email is written to `email_logs` BEFORE the Resend call
via `email_logs.log_email()`, then updated to `sent` (or `failed`) as
soon as we have the Resend provider id. Real delivery status arrives
later via the Resend webhook.
"""
from __future__ import annotations
import os
import logging
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse, JSONResponse
from pydantic import BaseModel, EmailStr
import httpx

from email_logs import log_email, mark_sent, mark_failed, ALLOWED_ALIASES

logger = logging.getLogger(__name__)

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM = os.environ.get("RESEND_FROM_EMAIL", "onboarding@resend.dev")
NOTIFY_ADMIN_EMAIL = os.environ.get("NOTIFY_ADMIN_EMAIL", "")

META_WA_TOKEN = os.environ.get("META_WA_TOKEN", "")
META_WA_PHONE_ID = os.environ.get("META_WA_PHONE_NUMBER_ID", "")
META_WA_VERIFY_TOKEN = os.environ.get("META_WA_VERIFY_TOKEN", "ssu-wa-verify")
ADMIN_NOTIFY_WHATSAPP = os.environ.get("ADMIN_NOTIFY_WHATSAPP", "")

router = APIRouter(prefix="/api/notify", tags=["notify"])


# ---------------------------------------------------------------- email (Resend)
class EmailPayload(BaseModel):
    to: EmailStr
    subject: str
    html: str
    cc: Optional[str] = None
    # New optional fields — used by internal callers so email_logs can link
    # the email to a user / ticket / order for the admin timeline.
    from_alias: Optional[str] = "noreply"
    event_type: Optional[str] = "generic"
    template: Optional[str] = None
    supabase_user_id: Optional[str] = None
    ticket_id: Optional[str] = None
    order_id: Optional[str] = None


def _sender_for(alias: Optional[str]) -> str:
    if alias and alias in ALLOWED_ALIASES:
        # Prefer the branded form: `SmartSetupUAE <alias@…>`
        return f"SmartSetupUAE <{ALLOWED_ALIASES[alias]}>"
    return RESEND_FROM


async def send_and_log_email(
    *,
    to: str,
    subject: str,
    html: str,
    cc: Optional[str] = None,
    from_alias: str = "noreply",
    event_type: str = "generic",
    template: Optional[str] = None,
    supabase_user_id: Optional[str] = None,
    ticket_id: Optional[str] = None,
    order_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Single, authoritative outbound email function. Every caller in the
    backend MUST use this — it logs first, then sends, then updates."""
    log_id = await log_email(
        event_type=event_type,
        to=to,
        subject=subject,
        from_alias=from_alias,
        template=template,
        supabase_user_id=supabase_user_id,
        ticket_id=ticket_id,
        order_id=order_id,
        cc=[cc] if cc else None,
    )
    if not RESEND_API_KEY:
        await mark_failed(log_id, "RESEND_API_KEY not configured")
        return {"ok": False, "skipped": True, "log_id": log_id,
                "reason": "RESEND_API_KEY not configured"}

    payload: Dict[str, Any] = {
        "from": _sender_for(from_alias),
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if cc:
        payload["cc"] = [cc]
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {RESEND_API_KEY}",
                         "Content-Type": "application/json"},
                json=payload,
            )
            if r.status_code >= 400:
                await mark_failed(log_id, f"HTTP {r.status_code}: {r.text[:1000]}")
                logger.warning("Resend send failed %s: %s", r.status_code, r.text)
                return {"ok": False, "status": r.status_code,
                        "error": r.text, "log_id": log_id}
            provider_id = r.json().get("id", "")
            await mark_sent(log_id, provider_id)
            return {"ok": True, "id": provider_id, "log_id": log_id}
    except Exception as e:
        await mark_failed(log_id, f"transport error: {e}")
        return {"ok": False, "error": str(e), "log_id": log_id}


# Legacy wrapper — many callers use `_send_resend_email` internally.
async def _send_resend_email(to: str, subject: str, html: str,
                             cc: Optional[str] = None,
                             from_alias: str = "noreply",
                             event_type: str = "generic") -> Dict[str, Any]:
    return await send_and_log_email(
        to=to, subject=subject, html=html, cc=cc,
        from_alias=from_alias, event_type=event_type,
    )


@router.post("/email")
async def send_email(body: EmailPayload):
    res = await send_and_log_email(
        to=body.to, subject=body.subject, html=body.html, cc=body.cc,
        from_alias=body.from_alias or "noreply",
        event_type=body.event_type or "generic",
        template=body.template,
        supabase_user_id=body.supabase_user_id,
        ticket_id=body.ticket_id,
        order_id=body.order_id,
    )
    if not res.get("ok") and not res.get("skipped"):
        raise HTTPException(502, res.get("error") or "Email send failed")
    return res


@router.post("/email/test")
async def send_test_email(body: EmailPayload):
    """Admin-only test email trigger. In production the admin panel calls
    this with `from_alias` pinned to one of the whitelisted senders — no
    RESEND_API_KEY is ever exposed to the browser."""
    body.event_type = "test"
    return await send_email(body)



# ---------------------------------------------------------- WhatsApp (Meta Cloud)
class WAPayload(BaseModel):
    to: str               # E.164 without + e.g. "919812345678"
    text: Optional[str] = None
    template: Optional[str] = None  # e.g. "hello_world"
    language_code: Optional[str] = "en"


async def _send_wa(to: str, text: Optional[str] = None, template: Optional[str] = None, language_code: str = "en") -> Dict[str, Any]:
    if not (META_WA_TOKEN and META_WA_PHONE_ID):
        return {"ok": False, "skipped": True, "reason": "Meta WhatsApp not configured"}

    url = f"https://graph.facebook.com/v20.0/{META_WA_PHONE_ID}/messages"
    headers = {"Authorization": f"Bearer {META_WA_TOKEN}", "Content-Type": "application/json"}
    body: Dict[str, Any]
    if template:
        body = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "template",
            "template": {"name": template, "language": {"code": language_code}},
        }
    else:
        # Free-form text only works inside the 24h customer service window.
        body = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "text",
            "text": {"body": (text or "Hello from SmartSetupUAE")[:4096]},
        }
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(url, headers=headers, json=body)
        if r.status_code >= 400:
            logger.warning("WA send failed %s: %s", r.status_code, r.text)
            return {"ok": False, "status": r.status_code, "error": r.text}
        return {"ok": True, "data": r.json()}


@router.post("/whatsapp")
async def send_whatsapp(payload: WAPayload):
    res = await _send_wa(payload.to, payload.text, payload.template, payload.language_code or "en")
    if not res.get("ok") and not res.get("skipped"):
        raise HTTPException(502, res.get("error") or "WhatsApp send failed")
    return res


# -------- Webhook for Meta WhatsApp (Meta will GET to verify, POST for messages)
@router.get("/whatsapp/webhook")
async def wa_verify(request: Request):
    params = request.query_params
    if params.get("hub.mode") == "subscribe" and params.get("hub.verify_token") == META_WA_VERIFY_TOKEN:
        challenge = params.get("hub.challenge", "")
        return PlainTextResponse(challenge)
    raise HTTPException(403, "verify token mismatch")


@router.post("/whatsapp/webhook")
async def wa_webhook(request: Request):
    body = await request.json()
    logger.info("WA inbound: %s", str(body)[:600])
    # Stub: in future, route to Aria for AI auto-reply. For now just ack.
    return JSONResponse({"ok": True})


# ---------------------------------------------- helper used by lead/order modules
class LeadAlert(BaseModel):
    lead_name: str
    lead_phone: str
    lead_email: Optional[str] = ""
    source: Optional[str] = "website"
    summary: Optional[str] = ""


@router.post("/lead-alert")
async def lead_alert(payload: LeadAlert):
    """Notify admin via email + WhatsApp when a new lead arrives."""
    email_html = f"""
    <div style="font-family:Inter,system-ui,Arial,sans-serif;background:#fbfaf6;padding:24px;color:#0f172a">
      <h2 style="margin:0 0 12px;color:#0f766e">🚀 New SmartSetupUAE lead</h2>
      <table style="border-collapse:collapse;width:100%;max-width:520px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
        <tr><td style="padding:10px 14px;font-weight:600">Name</td><td style="padding:10px 14px">{payload.lead_name}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:600;background:#f8fafc">Phone</td><td style="padding:10px 14px;background:#f8fafc">{payload.lead_phone}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:600">Email</td><td style="padding:10px 14px">{payload.lead_email or '—'}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:600;background:#f8fafc">Source</td><td style="padding:10px 14px;background:#f8fafc">{payload.source}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:600">Summary</td><td style="padding:10px 14px">{payload.summary or '—'}</td></tr>
      </table>
      <p style="margin:18px 0 0;font-size:12px;color:#64748b">SmartSetupUAE · Axiscrest-Global FZE LLC</p>
    </div>
    """
    out: Dict[str, Any] = {}
    if NOTIFY_ADMIN_EMAIL:
        out["email"] = await _send_resend_email(NOTIFY_ADMIN_EMAIL, f"New lead: {payload.lead_name}", email_html)
    if ADMIN_NOTIFY_WHATSAPP:
        wa_text = f"New SmartSetupUAE lead\nName: {payload.lead_name}\nPhone: {payload.lead_phone}\nEmail: {payload.lead_email or '-'}\nSource: {payload.source}\n{payload.summary or ''}"
        out["whatsapp"] = await _send_wa(ADMIN_NOTIFY_WHATSAPP, wa_text)
    return {"ok": True, **out}
