"""Founder portal lifecycle APIs — progress tracker, appointments, profile,
document vault metadata, compliance, renewals, golden-visa leads.

Persists in MongoDB (collections: application_progress, appointments,
client_profiles_ext, document_vault, compliance_status, renewals,
golden_visa_leads, invoices, notifications, audit_logs).
"""
from __future__ import annotations
import os, logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Literal
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel, Field, EmailStr
from motor.motor_asyncio import AsyncIOMotorClient
import httpx
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/lifecycle", tags=["lifecycle"])

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "smartsetupuae")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

_mongo = AsyncIOMotorClient(MONGO_URL)
_db = _mongo[DB_NAME]

SVC = {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"}

# ---------- 17-step formation timeline (PART 1) ----------
TIMELINE_STEPS = [
    {"key": "lead_created",          "title": "Lead Created"},
    {"key": "consultation_scheduled","title": "Consultation Scheduled"},
    {"key": "activity_selected",     "title": "Business Activity Selected"},
    {"key": "freezone_selected",     "title": "Freezone Selected"},
    {"key": "quotation_approved",    "title": "Quotation Approved"},
    {"key": "payment_received",      "title": "Payment Received"},
    {"key": "name_reservation",      "title": "Name Reservation"},
    {"key": "initial_approval",      "title": "Initial Approval"},
    {"key": "license_issued",        "title": "License Issued"},
    {"key": "establishment_card",    "title": "Establishment Card"},
    {"key": "visa_application",      "title": "Visa Application"},
    {"key": "medical_test",          "title": "Medical Test"},
    {"key": "biometrics",            "title": "Biometrics"},
    {"key": "emirates_id_processing","title": "Emirates ID Processing"},
    {"key": "emirates_id_issued",    "title": "Emirates ID Issued"},
    {"key": "bank_account",          "title": "Bank Account Assistance"},
    {"key": "completed",             "title": "Completed"},
]


# ----------------- AUTH HELPER (Supabase JWT) -----------------
async def get_user(authorization: str = Header(default="")) -> dict:
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{SUPABASE_URL}/auth/v1/user",
                        headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {token}"})
        if r.status_code >= 400:
            raise HTTPException(401, "Invalid token")
        u = r.json()
        # Look up role
        p = await c.get(f"{SUPABASE_URL}/rest/v1/profiles",
                        params={"id": f"eq.{u['id']}", "select": "id,email,role,full_name"},
                        headers=SVC)
        prof = (p.json() or [{}])[0] if p.status_code < 300 else {}
        return {"id": u["id"], "email": u.get("email"), "role": prof.get("role") or "client",
                "full_name": prof.get("full_name") or ""}


async def get_user_or_anon(authorization: str = Header(default="")) -> dict:
    try:
        return await get_user(authorization)
    except HTTPException:
        return {"id": None, "email": None, "role": "anon", "full_name": ""}


def _now():
    return datetime.now(timezone.utc).isoformat()


# ============== PROGRESS TRACKER ==============
class ProgressStepUpdate(BaseModel):
    step_key: str
    status: Literal["pending", "in_progress", "completed", "blocked"] = "pending"
    assigned_staff_email: Optional[str] = None
    date_started: Optional[str] = None
    date_completed: Optional[str] = None
    expected_completion: Optional[str] = None
    notes: Optional[str] = None
    document_refs: Optional[List[str]] = None


@router.get("/progress/steps")
async def progress_steps_def():
    return {"steps": TIMELINE_STEPS}


@router.get("/progress")
async def get_progress(order_ref: str, user: dict = Depends(get_user)):
    """Get progress for an order. Client sees only their own; staff/admin sees any."""
    doc = await _db.application_progress.find_one({"order_ref": order_ref}, {"_id": 0})
    if not doc:
        # Initialize default
        steps = {s["key"]: {"status": "pending"} for s in TIMELINE_STEPS}
        steps["lead_created"] = {"status": "completed", "date_completed": _now()}
        doc = {
            "order_ref": order_ref,
            "owner_email": user["email"],
            "steps": steps,
            "created_at": _now(),
            "updated_at": _now(),
        }
        await _db.application_progress.insert_one(dict(doc))
        doc.pop("_id", None)
    # client gate
    if user["role"] == "client" and doc.get("owner_email") and doc["owner_email"] != user["email"]:
        raise HTTPException(403, "Not your order")
    return doc


@router.patch("/progress")
async def update_progress(order_ref: str, update: ProgressStepUpdate, user: dict = Depends(get_user)):
    if user["role"] == "client":
        raise HTTPException(403, "Only staff can update progress")
    if update.step_key not in {s["key"] for s in TIMELINE_STEPS}:
        raise HTTPException(400, f"Unknown step_key {update.step_key}")
    set_doc = {f"steps.{update.step_key}": {k: v for k, v in update.model_dump().items() if v is not None and k != "step_key"}}
    set_doc["updated_at"] = _now()
    set_doc[f"steps.{update.step_key}.updated_by"] = user["email"]
    await _db.application_progress.update_one(
        {"order_ref": order_ref},
        {"$set": set_doc,
         "$setOnInsert": {"order_ref": order_ref, "created_at": _now()}},
        upsert=True,
    )
    return {"ok": True}


# ============== APPOINTMENTS ==============
class Appointment(BaseModel):
    order_ref: str
    client_email: EmailStr
    appointment_type: Literal["medical_test", "biometrics", "visa_stamping", "bank_meeting", "consultation"]
    date: str  # ISO datetime
    location_name: str
    address: str
    contact_number: Optional[str] = ""
    map_url: Optional[str] = ""
    qr_code_data: Optional[str] = ""
    documents_required: Optional[List[str]] = []
    status: Optional[Literal["scheduled", "completed", "missed", "rescheduled"]] = "scheduled"
    notes: Optional[str] = ""


@router.post("/appointments")
async def create_appointment(a: Appointment, user: dict = Depends(get_user)):
    if user["role"] == "client":
        raise HTTPException(403, "Only staff can schedule appointments")
    doc = a.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = _now()
    doc["created_by"] = user["email"]
    await _db.appointments.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/appointments")
async def list_appointments(client_email: Optional[str] = None, user: dict = Depends(get_user)):
    q: Dict[str, Any] = {}
    if user["role"] == "client":
        q["client_email"] = user["email"]
    elif client_email:
        q["client_email"] = client_email
    rows = await _db.appointments.find(q, {"_id": 0}).sort("date", 1).to_list(200)
    return {"appointments": rows}


# ============== EXTENDED PROFILE ==============
class ExtendedProfile(BaseModel):
    full_name: Optional[str] = ""
    nationality: Optional[str] = ""
    passport_number: Optional[str] = ""
    emirates_id_number: Optional[str] = ""
    father_name: Optional[str] = ""
    mother_name: Optional[str] = ""
    uae_address: Optional[str] = ""
    home_country_address: Optional[str] = ""
    mobile: Optional[str] = ""
    whatsapp: Optional[str] = ""
    residency_status: Optional[str] = ""
    occupation: Optional[str] = ""
    date_of_birth: Optional[str] = ""
    gender: Optional[str] = ""
    place_of_birth: Optional[str] = ""


@router.get("/profile")
async def get_profile(user: dict = Depends(get_user)):
    doc = await _db.client_profiles_ext.find_one({"email": user["email"]}, {"_id": 0})
    if not doc:
        return {"email": user["email"], **ExtendedProfile().model_dump(), "history": []}
    doc.setdefault("history", [])
    return doc


@router.put("/profile")
async def put_profile(p: ExtendedProfile, user: dict = Depends(get_user)):
    existing = await _db.client_profiles_ext.find_one({"email": user["email"]}, {"_id": 0})
    new_data = p.model_dump()
    history = existing.get("history", []) if existing else []
    if existing:
        snapshot = {k: existing.get(k) for k in new_data.keys()}
        history.append({"at": _now(), "by": user["email"], "snapshot": snapshot})
        history = history[-20:]  # keep last 20
    await _db.client_profiles_ext.update_one(
        {"email": user["email"]},
        {"$set": {**new_data, "history": history, "updated_at": _now(), "email": user["email"]}},
        upsert=True,
    )
    return {"ok": True}


# ============== DOCUMENT VAULT METADATA ==============
VAULT_FOLDERS = ["company", "visa", "tax", "bank", "contracts"]


class VaultEntry(BaseModel):
    folder: Literal["company", "visa", "tax", "bank", "contracts"]
    file_name: str
    label: str
    file_url: Optional[str] = None  # if uploaded externally
    file_b64: Optional[str] = None
    file_size_bytes: Optional[int] = 0
    mime_type: Optional[str] = "application/pdf"
    notes: Optional[str] = ""


@router.post("/vault")
async def vault_add(entry: VaultEntry, user: dict = Depends(get_user)):
    doc = entry.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["owner_email"] = user["email"]
    doc["uploaded_at"] = _now()
    await _db.document_vault.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/vault")
async def vault_list(client_email: Optional[str] = None, user: dict = Depends(get_user)):
    q: Dict[str, Any] = {}
    if user["role"] == "client":
        q["owner_email"] = user["email"]
    elif client_email:
        q["owner_email"] = client_email
    rows = await _db.document_vault.find(q, {"_id": 0, "file_b64": 0}).sort("uploaded_at", -1).to_list(500)
    by_folder = {f: [] for f in VAULT_FOLDERS}
    for r in rows:
        by_folder.setdefault(r.get("folder", "company"), []).append(r)
    return {"folders": by_folder, "total": len(rows)}


@router.get("/vault/{vault_id}/download")
async def vault_download(vault_id: str, user: dict = Depends(get_user)):
    doc = await _db.document_vault.find_one({"id": vault_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    if user["role"] == "client" and doc.get("owner_email") != user["email"]:
        raise HTTPException(403, "Forbidden")
    return doc


@router.delete("/vault/{vault_id}")
async def vault_delete(vault_id: str, user: dict = Depends(get_user)):
    doc = await _db.document_vault.find_one({"id": vault_id})
    if not doc:
        raise HTTPException(404, "Not found")
    if user["role"] == "client" and doc.get("owner_email") != user["email"]:
        raise HTTPException(403, "Forbidden")
    await _db.document_vault.delete_one({"id": vault_id})
    return {"ok": True}


# ============== COMPLIANCE HUB ==============
class ComplianceStatus(BaseModel):
    company_id: Optional[str] = ""
    vat_status: Optional[Literal["registered", "not_registered", "pending"]] = "not_registered"
    vat_number: Optional[str] = ""
    vat_next_filing: Optional[str] = ""
    ct_status: Optional[Literal["registered", "not_registered", "pending"]] = "not_registered"
    ct_next_filing: Optional[str] = ""
    esr_status: Optional[Literal["compliant", "pending", "not_applicable"]] = "not_applicable"
    ubo_status: Optional[Literal["filed", "pending", "not_applicable"]] = "pending"
    aml_status: Optional[Literal["compliant", "review", "not_applicable"]] = "not_applicable"
    notes: Optional[str] = ""


@router.get("/compliance")
async def get_compliance(user: dict = Depends(get_user)):
    doc = await _db.compliance_status.find_one({"client_email": user["email"]}, {"_id": 0})
    if not doc:
        return {"client_email": user["email"], **ComplianceStatus().model_dump(), "reminders": []}
    return doc


@router.put("/compliance")
async def put_compliance(c: ComplianceStatus, user: dict = Depends(get_user)):
    if user["role"] == "client":
        raise HTTPException(403, "Only staff can update compliance")
    target_email = user["email"]  # could be extended to take ?email=
    await _db.compliance_status.update_one(
        {"client_email": target_email},
        {"$set": {**c.model_dump(), "client_email": target_email, "updated_at": _now()}},
        upsert=True,
    )
    return {"ok": True}


# ============== RENEWALS ==============
@router.get("/renewals")
async def list_renewals(user: dict = Depends(get_user)):
    q = {"client_email": user["email"]} if user["role"] == "client" else {}
    rows = await _db.renewals.find(q, {"_id": 0}).sort("due_date", 1).to_list(500)
    return {"renewals": rows}


class RenewalCreate(BaseModel):
    client_email: EmailStr
    renewal_type: Literal["license", "visa", "emirates_id", "passport", "tenancy", "founder_club", "vat_filing", "ct_filing"]
    due_date: str
    notes: Optional[str] = ""


@router.post("/renewals")
async def create_renewal(r: RenewalCreate, user: dict = Depends(get_user)):
    if user["role"] == "client":
        raise HTTPException(403)
    doc = r.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = _now()
    doc["status"] = "active"
    await _db.renewals.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ============== GOLDEN VISA LEAD ==============
class GoldenVisaLead(BaseModel):
    name: str = Field(..., min_length=2)
    phone: str = Field(..., min_length=6)
    whatsapp: Optional[str] = ""
    nationality: str
    current_country: str
    category: Literal["investor", "entrepreneur", "student", "professional", "talent", "other"]
    email: Optional[EmailStr] = None
    notes: Optional[str] = ""


@router.post("/golden-visa/lead")
async def golden_visa_lead(lead: GoldenVisaLead):
    doc = lead.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = _now()
    doc["status"] = "new"
    await _db.golden_visa_leads.insert_one(doc)

    # Also push to Supabase leads for unified CRM
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        async with httpx.AsyncClient(timeout=8) as c:
            try:
                await c.post(
                    f"{SUPABASE_URL}/rest/v1/leads",
                    headers={**SVC, "Content-Type": "application/json", "Prefer": "return=minimal"},
                    json={
                        "name": lead.name,
                        "email": lead.email or "",
                        "phone": lead.phone,
                        "whatsapp": lead.whatsapp,
                        "nationality": lead.nationality,
                        "source": "golden_visa_page",
                        "notes": f"Category: {lead.category} · Current country: {lead.current_country}. {lead.notes or ''}",
                        "status": "new",
                    },
                )
            except Exception as e:
                logger.warning("supabase lead push failed: %s", e)

    # Fire 7-trigger notifications (email + WhatsApp to client + admin mirror)
    try:
        import notify_triggers as nt
        await nt.notify_lead_submitted(
            lead_name=lead.name,
            lead_phone=lead.phone,
            lead_email=lead.email or "",
            source="golden_visa_page",
            summary=f"Category: {lead.category} · Country: {lead.current_country}. {lead.notes or ''}",
        )
    except Exception as e:
        logger.warning("notify_lead_submitted failed: %s", e)

    doc.pop("_id", None)
    return doc


@router.get("/golden-visa/leads")
async def list_golden_visa_leads(user: dict = Depends(get_user)):
    if user["role"] not in {"admin", "manager", "staff"}:
        raise HTTPException(403)
    rows = await _db.golden_visa_leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"leads": rows}


# ============== INVOICES (basic skeleton) ==============
class InvoiceCreate(BaseModel):
    order_ref: str
    client_email: EmailStr
    doc_type: Literal["quotation", "invoice", "receipt", "credit_note", "payment_confirmation"]
    line_items: List[Dict[str, Any]]  # [{"label","qty","unit_price","total"}]
    subtotal: float
    discount: float = 0
    tax: float = 0
    total: float
    currency: str = "AED"
    notes: Optional[str] = ""


@router.post("/invoices")
async def create_invoice(inv: InvoiceCreate, user: dict = Depends(get_user)):
    if user["role"] == "client":
        raise HTTPException(403)
    doc = inv.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["number"] = f"SSU-{inv.doc_type[:3].upper()}-{datetime.now().strftime('%Y%m%d')}-{doc['id'][:6].upper()}"
    doc["created_at"] = _now()
    doc["created_by"] = user["email"]
    await _db.invoices.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/invoices")
async def list_invoices(user: dict = Depends(get_user)):
    q = {"client_email": user["email"]} if user["role"] == "client" else {}
    rows = await _db.invoices.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"invoices": rows}
