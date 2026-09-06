"""Post-payment fulfilment.

Runs once per paid order (idempotent via Mongo `order_fulfilments`):
  * Founder Club purchase -> create/ensure a Supabase client-portal account,
    record the membership, and send the Resend welcome email listing benefits.
  * Standalone service purchase -> ensure a portal account + service email.
"""
from __future__ import annotations

import logging
import os
import secrets
import string
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SVC = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
}
SITE_URL = os.environ.get("SITE_URL", "https://smartsetupuae.ae").rstrip("/")

_mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
_db = _mongo[os.environ["DB_NAME"]]
_fulfilments = _db["order_fulfilments"]
_snapshots = _db["order_snapshots"]

FOUNDERS_SLUG = "founders-club-lifetime"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _temp_password() -> str:
    alphabet = string.ascii_letters + string.digits
    return "Ssu" + "".join(secrets.choice(alphabet) for _ in range(9)) + "!7"


async def ensure_portal_account(email: str, full_name: Optional[str] = None) -> Dict[str, Any]:
    """Create the Supabase auth user if missing. Returns {user_id, password}."""
    email = email.lower().strip()
    async with httpx.AsyncClient(timeout=15) as c:
        existing = await c.get(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            params={"filter": email, "per_page": "1"},
            headers=SVC,
        )
        users = (existing.json() or {}).get("users", []) if existing.status_code == 200 else []
        match = next((u for u in users if (u.get("email") or "").lower() == email), None)

        password = None
        if match:
            user_id = match.get("id")
        else:
            password = _temp_password()
            created = await c.post(
                f"{SUPABASE_URL}/auth/v1/admin/users",
                headers=SVC,
                json={
                    "email": email,
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": {"full_name": full_name or ""},
                },
            )
            if created.status_code >= 400:
                logger.warning("portal account creation failed %s: %s", created.status_code, created.text[:300])
                return {"user_id": None, "password": None, "created": False}
            user_id = (created.json() or {}).get("id")

        if user_id:
            # NOTE: `profiles.role` is an enum of staff roles only
            # (admin|manager|staff|reviewer). Customers deliberately have NO
            # profiles row — inserting one would grant staff privileges.
            await _db["client_profiles_ext"].update_one(
                {"_id": user_id},
                {"$set": {"email": email, "full_name": full_name or "", "updated_at": _now()},
                 "$setOnInsert": {"created_at": _now(), "source": "checkout_fulfilment"}},
                upsert=True,
            )

    return {"user_id": user_id, "password": password, "created": password is not None}


async def _record_membership(user_id: Optional[str], email: str, order_ref: str) -> None:
    async with httpx.AsyncClient(timeout=15) as c:
        try:
            await c.post(
                f"{SUPABASE_URL}/rest/v1/founder_club_memberships",
                headers={**SVC, "Prefer": "return=minimal"},
                json=[{
                    "user_id": user_id,
                    "status": "active",
                    "member_since": _now(),
                    "notes": f'{{"email":"{email}","source":"checkout","order_ref":"{order_ref}"}}',
                }],
            )
        except Exception as exc:
            logger.warning("founder membership insert failed: %s", exc)


def _shell(title: str, intro: str, blocks: str, cta_label: str, cta_url: str) -> str:
    return f"""
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#F5F7FA;padding:28px">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:#0A3D34;padding:26px 30px">
      <div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-.3px">SmartSetupUAE</div>
      <div style="color:#A9C0BB;font-size:11px;text-transform:uppercase;letter-spacing:.22em;margin-top:6px">{title}</div>
    </div>
    <div style="padding:30px">
      <p style="font-size:15px;color:#0f172a;line-height:1.6;margin:0 0 18px">{intro}</p>
      {blocks}
      <a href="{cta_url}" style="display:inline-block;margin-top:22px;background:#0A3D34;color:#fff;text-decoration:none;padding:13px 22px;border-radius:11px;font-weight:600;font-size:14px">{cta_label}</a>
      <p style="font-size:12px;color:#64748b;line-height:1.6;margin:26px 0 0">
        Questions? Reply to this email or WhatsApp us on +971 58 590 3155.
      </p>
    </div>
    <div style="background:#f8fafc;padding:16px 30px;font-size:11px;color:#94a3b8">
      Axiscrest Global FZE LLC · Licence 262843696888 · Dubai, UAE
    </div>
  </div>
</div>"""


def _features_html(items: List[str]) -> str:
    rows = "".join(
        f'<tr><td style="padding:7px 0;color:#0A3D34;font-weight:700;width:20px">✓</td>'
        f'<td style="padding:7px 0;font-size:14px;color:#1e293b">{f}</td></tr>'
        for f in items
    )
    return f'<table style="width:100%;border-collapse:collapse">{rows}</table>'


def _credentials_html(email: str, password: Optional[str]) -> str:
    if not password:
        return (f'<div style="background:#F1F5F9;border-radius:12px;padding:16px;margin-top:18px;font-size:13px;color:#334155">'
                f'Sign in to your client portal with your existing password — <b>{email}</b>. '
                f'Forgot it? Use “Reset password” on the login page.</div>')
    return (f'<div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:12px;padding:16px;margin-top:18px">'
            f'<div style="font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:#047857;font-weight:700">Your client portal login</div>'
            f'<div style="font-size:14px;color:#0f172a;margin-top:8px">Email: <b>{email}</b></div>'
            f'<div style="font-size:14px;color:#0f172a;margin-top:4px">Temporary password: <b style="font-family:monospace">{password}</b></div>'
            f'<div style="font-size:12px;color:#475569;margin-top:8px">Please change it after your first sign-in.</div></div>')


async def fulfill_order(order_ref: str, customer_email: str) -> Dict[str, Any]:
    """Idempotent. `order_ref` is the checkout_orders row id."""
    if not order_ref:
        return {"ok": False, "reason": "no order_ref"}
    if await _fulfilments.find_one({"_id": order_ref}):
        return {"ok": True, "already": True}

    snap = await _snapshots.find_one({"_id": order_ref}) or {}
    line_items = snap.get("line_items") or []
    email = (snap.get("customer_email") or customer_email or "").lower().strip()
    if not email:
        return {"ok": False, "reason": "no customer email"}
    full_name = snap.get("customer_name") or ""

    has_founders = any(li.get("ref") == FOUNDERS_SLUG for li in line_items)
    services = [li for li in line_items if li.get("kind") == "service" and li.get("ref") != FOUNDERS_SLUG]

    account = await ensure_portal_account(email, full_name)
    from notifications import send_and_log_email

    sent: List[str] = []
    if has_founders:
        await _record_membership(account.get("user_id"), email, order_ref)
        benefits = next((li for li in line_items if li.get("ref") == FOUNDERS_SLUG), {})
        features = benefits.get("features") or [
            "Lifetime licence renewal discount",
            "AED 0 advisory / setup service fee (first 500 founders)",
            "Dedicated advisor on WhatsApp",
            "Founder pricing on tax, audit and bookkeeping",
            "Priority support queue and partner perks",
        ]
        html = _shell(
            "Founder Club · Membership Active",
            f"Welcome to the Founder Club{(' , ' + full_name) if full_name else ''}. Your one-time AED 999 lifetime membership is now active — here is everything it unlocks:",
            _features_html(features) + _credentials_html(email, account.get("password")),
            "Open my client portal",
            f"{SITE_URL}/login",
        )
        res = await send_and_log_email(
            to=email,
            subject="Welcome to the SmartSetupUAE Founder Club 🎉",
            html=html,
            from_alias="foundersclub",
            event_type="founders_club_welcome",
            template="founders_club_welcome",
            order_id=order_ref,
        )
        sent.append(f"founders_club_welcome:{res.get('ok')}")

    if services:
        blocks = "".join(
            f'<div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:10px">'
            f'<div style="font-size:15px;font-weight:700;color:#0A3D34">{li.get("name")}</div>'
            f'<div style="font-size:13px;color:#475569;margin-top:3px">{li.get("price_label")}</div>'
            f'{_features_html(li.get("features") or [])}</div>'
            for li in services
        )
        html = _shell(
            "Service Confirmed",
            f"Thank you{(' , ' + full_name) if full_name else ''} — your payment is confirmed and your advisor is being assigned. Here is what you purchased:",
            blocks + _credentials_html(email, account.get("password")),
            "Track it in my portal",
            f"{SITE_URL}/dashboard",
        )
        res = await send_and_log_email(
            to=email,
            subject="Your SmartSetupUAE service is confirmed",
            html=html,
            from_alias="account",
            event_type="service_purchase_confirmed",
            template="service_purchase_confirmed",
            order_id=order_ref,
        )
        sent.append(f"service_purchase_confirmed:{res.get('ok')}")

    await _fulfilments.insert_one({
        "_id": order_ref,
        "customer_email": email,
        "portal_user_id": account.get("user_id"),
        "portal_account_created": account.get("created"),
        "founders_club": has_founders,
        "services": [li.get("ref") for li in services],
        "emails": sent,
        "fulfilled_at": _now(),
    })
    return {"ok": True, "emails": sent, "founders_club": has_founders}
