"""API endpoints to fire any of the 7 notification triggers manually.

Used by:
- Admin Panel "Send test message" button
- Internal flows when admins want to nudge a client
- Renewal cron (future)

Also auto-wired into:
- Golden Visa lead submission → notify_lead_submitted
- Stripe payment success → notify_order_placed
- Founder Club purchase → notify_founder_club
"""
from __future__ import annotations
import os, logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, EmailStr
import httpx

import notify_triggers as nt

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/notify-triggers", tags=["notify-triggers"])

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SVC = {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"}


async def _require_admin(authorization: str = Header(default="")) -> dict:
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{SUPABASE_URL}/auth/v1/user",
                        headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {token}"})
        if r.status_code >= 400:
            raise HTTPException(401, "Invalid token")
        u = r.json()
        p = await c.get(f"{SUPABASE_URL}/rest/v1/profiles",
                        params={"id": f"eq.{u['id']}", "select": "id,email,role"}, headers=SVC)
        prof = (p.json() or [{}])[0] if p.status_code < 300 else {}
        if prof.get("role") not in {"admin", "manager", "staff"}:
            raise HTTPException(403, "Staff only")
        return {"id": u["id"], "email": u.get("email"), "role": prof.get("role")}


class LeadIn(BaseModel):
    lead_name: str
    lead_phone: Optional[str] = ""
    lead_email: Optional[EmailStr] = None
    source: Optional[str] = "website"
    summary: Optional[str] = ""


@router.post("/lead-submitted")
async def trigger_lead(p: LeadIn):
    return await nt.notify_lead_submitted(
        lead_name=p.lead_name, lead_phone=p.lead_phone or "",
        lead_email=p.lead_email or "", source=p.source or "website",
        summary=p.summary or "",
    )


class OrderIn(BaseModel):
    client_email: EmailStr
    client_name: Optional[str] = ""
    client_whatsapp: Optional[str] = ""
    order_ref: Optional[str] = ""
    amount: float = 0
    currency: str = "AED"
    package_name: Optional[str] = ""
    line_items: Optional[List[str]] = None
    paid: bool = True


@router.post("/order-placed")
async def trigger_order(p: OrderIn, _=Depends(_require_admin)):
    return await nt.notify_order_placed(**p.model_dump())


class DocApprovedIn(BaseModel):
    client_email: EmailStr
    client_name: Optional[str] = ""
    client_whatsapp: Optional[str] = ""
    doc_label: str = "Document"
    reviewer: Optional[str] = ""


@router.post("/doc-approved")
async def trigger_doc_approved(p: DocApprovedIn, _=Depends(_require_admin)):
    return await nt.notify_doc_approved(**p.model_dump())


class DocRejectedIn(BaseModel):
    client_email: EmailStr
    client_name: Optional[str] = ""
    client_whatsapp: Optional[str] = ""
    doc_label: str = "Document"
    reason: str = "Document is unclear or expired"


@router.post("/doc-rejected")
async def trigger_doc_rejected(p: DocRejectedIn, _=Depends(_require_admin)):
    return await nt.notify_doc_rejected(**p.model_dump())


class AppointmentIn(BaseModel):
    client_email: EmailStr
    client_name: Optional[str] = ""
    client_whatsapp: Optional[str] = ""
    appointment_type: str = "Medical Test"
    date_iso: str
    location: str = ""
    address: str = ""
    map_url: Optional[str] = ""
    documents: Optional[List[str]] = None


@router.post("/appointment-scheduled")
async def trigger_appt(p: AppointmentIn, _=Depends(_require_admin)):
    return await nt.notify_appointment_scheduled(**p.model_dump())


class RenewalIn(BaseModel):
    client_email: EmailStr
    client_name: Optional[str] = ""
    client_whatsapp: Optional[str] = ""
    renewal_type: str = "license"
    due_date: str
    days_remaining: int = 0


@router.post("/renewal-reminder")
async def trigger_renewal(p: RenewalIn, _=Depends(_require_admin)):
    return await nt.notify_renewal_reminder(**p.model_dump())


class FounderClubIn(BaseModel):
    client_email: EmailStr
    client_name: Optional[str] = ""
    client_whatsapp: Optional[str] = ""
    expiry_date: Optional[str] = "Lifetime"


@router.post("/founder-club-purchased")
async def trigger_fc(p: FounderClubIn, _=Depends(_require_admin)):
    return await nt.notify_founder_club(**p.model_dump())


@router.get("/status")
async def status():
    """Quick health check for both providers + Phone Number ID."""
    return {
        "resend_configured": bool(os.environ.get("RESEND_API_KEY")),
        "resend_from": os.environ.get("RESEND_FROM_EMAIL", ""),
        "whatsapp_configured": bool(os.environ.get("META_WA_TOKEN") and os.environ.get("META_WA_PHONE_NUMBER_ID")),
        "whatsapp_phone_id": os.environ.get("META_WA_PHONE_NUMBER_ID", ""),
        "admin_email": os.environ.get("NOTIFY_ADMIN_EMAIL", ""),
        "admin_whatsapp": os.environ.get("ADMIN_NOTIFY_WHATSAPP", ""),
    }
