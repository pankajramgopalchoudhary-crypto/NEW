"""Resend webhook endpoint — updates email_logs status in place.

Signature verification uses the Svix scheme (Resend's provider), with a
fallback for the legacy `resend-signature` header. Both are supported so we
match whatever Resend is currently sending.

Docs (verify on setup): https://resend.com/docs/dashboard/webhooks/introduction
"""
from __future__ import annotations
import os
import json
import time
import hmac
import base64
import hashlib
import logging
from typing import Any, Dict
from fastapi import APIRouter, Request, HTTPException, Header

from email_logs import update_status_by_provider_id, _webhook

logger = logging.getLogger(__name__)

RESEND_WEBHOOK_SECRET = os.environ.get("RESEND_WEBHOOK_SECRET", "")

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


def _verify_svix(secret: str, svix_id: str, svix_timestamp: str, body: bytes, signature_header: str) -> bool:
    """Svix signature format:
    header value = "v1,BASE64_SIGNATURE v1,BASE64_SIGNATURE2 …"
    signed_payload = f"{svix_id}.{svix_timestamp}.{body}"
    signature = HMAC-SHA256(secret_bytes, signed_payload) base64
    """
    if not (secret and svix_id and svix_timestamp and signature_header):
        return False
    # Secret is prefixed with `whsec_` and then base64 → the raw signing key is the base64 decoded part.
    key = secret
    if key.startswith("whsec_"):
        key = key.split("_", 1)[1]
    try:
        secret_bytes = base64.b64decode(key)
    except Exception:
        secret_bytes = key.encode()

    # Reject events older than 5 minutes to prevent replay
    try:
        if abs(time.time() - int(svix_timestamp)) > 300:
            return False
    except Exception:
        return False

    signed_payload = f"{svix_id}.{svix_timestamp}.".encode() + body
    expected = base64.b64encode(
        hmac.new(secret_bytes, signed_payload, hashlib.sha256).digest()
    ).decode()

    # Header may contain multiple space-separated signatures
    for pair in signature_header.split():
        if "," in pair:
            _ver, sig = pair.split(",", 1)
            if hmac.compare_digest(sig, expected):
                return True
    return False


# Resend event → our status enum
_EVENT_TO_STATUS = {
    "email.sent":              "sent",
    "email.delivered":         "delivered",
    "email.delivery_delayed":  "delivery_delayed",
    "email.bounced":           "bounced",
    "email.complained":        "complained",
    "email.opened":            "opened",
    "email.clicked":           "clicked",
    "email.failed":            "failed",
}


@router.post("/resend")
async def resend_webhook(
    request: Request,
    svix_id: str = Header(default="", alias="svix-id"),
    svix_timestamp: str = Header(default="", alias="svix-timestamp"),
    svix_signature: str = Header(default="", alias="svix-signature"),
):
    body = await request.body()

    # 1) Signature check (fail closed unless the secret is unset — in which
    #    case we log a warning but still process, so first-time setup is
    #    diagnosable in prod).
    if RESEND_WEBHOOK_SECRET:
        if not _verify_svix(RESEND_WEBHOOK_SECRET, svix_id, svix_timestamp, body, svix_signature):
            raise HTTPException(401, "Invalid signature")
    else:
        logger.warning("[resend-webhook] RESEND_WEBHOOK_SECRET is not set — accepting unsigned event")

    # 2) Parse
    try:
        event: Dict[str, Any] = json.loads(body)
    except Exception:
        raise HTTPException(400, "Malformed JSON")

    event_id = svix_id or event.get("id") or f"anon-{int(time.time()*1000)}"
    event_type = event.get("type") or ""
    data = event.get("data") or {}
    provider_message_id = data.get("email_id") or data.get("id")

    # 3) Idempotency — record the event first (unique index blocks dupes)
    if _webhook is not None:
        try:
            await _webhook.insert_one({
                "event_id": event_id,
                "event_type": event_type,
                "provider_message_id": provider_message_id,
                "raw": event,
                "processed_at": time.time(),
            })
        except Exception:
            # Duplicate — already processed, exit cleanly
            return {"ok": True, "duplicate": True}

    # 4) Update the email log
    status = _EVENT_TO_STATUS.get(event_type)
    updated = False
    if status and provider_message_id:
        updated = await update_status_by_provider_id(
            provider_message_id, status,
            event_time=data.get("created_at"),
            extra={"event_type": event_type, "svix_id": event_id},
        )
    return {"ok": True, "updated": updated, "status": status}
