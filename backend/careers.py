"""Careers module — public job postings + applications.

- GET    /api/careers/jobs                — public listing (only active)
- GET    /api/careers/jobs/{job_id}       — public detail
- POST   /api/careers/applications        — public application submission (with optional resume URL)
- GET    /api/admin/careers/jobs          — admin-only full list
- POST   /api/admin/careers/jobs          — admin-only create
- PATCH  /api/admin/careers/jobs/{id}     — admin-only update
- DELETE /api/admin/careers/jobs/{id}     — admin-only delete
- GET    /api/admin/careers/applications  — admin-only application list

Stores everything in MongoDB. Sends an email notification to career@ on each
application via Resend if RESEND_API_KEY is configured.
"""
from __future__ import annotations
import os
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)
router = APIRouter(tags=["careers"])

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "smartsetupuae_admin")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM_CAREER = os.environ.get(
    "RESEND_FROM_CAREER", "SmartSetupUAE Careers <career@smartsetupuae.ae>"
)
CAREER_INBOX = os.environ.get("CAREER_INBOX", "career@smartsetupuae.ae")

_mongo = AsyncIOMotorClient(MONGO_URL)
_db = _mongo[DB_NAME]
_jobs = _db["careers_jobs"]
_apps = _db["careers_applications"]

ADMIN_EMAIL = (os.environ.get("FOUNDER_EMAIL", "") or "").lower()


# ────────────────────────────────────────────────────────────────────────────
# Models
# ────────────────────────────────────────────────────────────────────────────
class Job(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    department: str = "Operations"
    location: str = "Dubai, UAE"
    employment_type: str = "Full-time"  # Full-time / Part-time / Contract
    experience: str = "Mid-level"
    salary_range: Optional[str] = None
    description: str = ""
    responsibilities: List[str] = []
    requirements: List[str] = []
    perks: List[str] = []
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class JobCreate(BaseModel):
    title: str
    department: str = "Operations"
    location: str = "Dubai, UAE"
    employment_type: str = "Full-time"
    experience: str = "Mid-level"
    salary_range: Optional[str] = None
    description: str = ""
    responsibilities: List[str] = []
    requirements: List[str] = []
    perks: List[str] = []
    is_active: bool = True


class JobUpdate(BaseModel):
    title: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    experience: Optional[str] = None
    salary_range: Optional[str] = None
    description: Optional[str] = None
    responsibilities: Optional[List[str]] = None
    requirements: Optional[List[str]] = None
    perks: Optional[List[str]] = None
    is_active: Optional[bool] = None


class Application(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    job_title: str = ""
    name: str
    email: EmailStr
    phone: str = ""
    nationality: str = ""
    years_experience: str = ""
    cover_letter: str = ""
    resume_url: str = ""  # public URL where they uploaded their CV (optional)
    status: str = "new"   # new / shortlisted / rejected / hired
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ApplicationCreate(BaseModel):
    job_id: str
    name: str
    email: EmailStr
    phone: str = ""
    nationality: str = ""
    years_experience: str = ""
    cover_letter: str = ""
    resume_url: str = ""


def _doc(item) -> dict:
    """Convert to a JSON-safe dict for Mongo storage."""
    d = item.model_dump()
    if isinstance(d.get("created_at"), datetime):
        d["created_at"] = d["created_at"].isoformat()
    return d


def _from_doc(d: dict) -> dict:
    if not d:
        return d
    d.pop("_id", None)
    return d


# ────────────────────────────────────────────────────────────────────────────
# Admin guard — simple header check for now (admin email match).
# In production: replace with JWT from admin login.
# ────────────────────────────────────────────────────────────────────────────
def _check_admin(x_admin_email: str = "") -> bool:
    if not ADMIN_EMAIL:
        return True  # dev mode — no guard
    return (x_admin_email or "").lower() == ADMIN_EMAIL


# ────────────────────────────────────────────────────────────────────────────
# Public endpoints
# ────────────────────────────────────────────────────────────────────────────
@router.get("/api/careers/jobs")
async def list_public_jobs():
    cursor = _jobs.find({"is_active": True}).sort("created_at", -1)
    docs = await cursor.to_list(200)
    return {"jobs": [_from_doc(d) for d in docs]}


@router.get("/api/careers/jobs/{job_id}")
async def get_public_job(job_id: str):
    doc = await _jobs.find_one({"id": job_id, "is_active": True})
    if not doc:
        raise HTTPException(404, "Job not found")
    return _from_doc(doc)


@router.post("/api/careers/applications")
async def submit_application(payload: ApplicationCreate):
    job = await _jobs.find_one({"id": payload.job_id, "is_active": True})
    if not job:
        raise HTTPException(404, "Job not found or no longer active")

    app = Application(
        job_id=payload.job_id,
        job_title=job.get("title", ""),
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        nationality=payload.nationality,
        years_experience=payload.years_experience,
        cover_letter=payload.cover_letter,
        resume_url=payload.resume_url,
    )
    await _apps.insert_one(_doc(app))

    # Send email to career@ inbox (best-effort)
    if RESEND_API_KEY:
        try:
            import resend
            resend.api_key = RESEND_API_KEY
            html = f"""
            <h2>New application: {app.job_title}</h2>
            <p><b>Name:</b> {app.name}</p>
            <p><b>Email:</b> {app.email}</p>
            <p><b>Phone:</b> {app.phone or '—'}</p>
            <p><b>Nationality:</b> {app.nationality or '—'}</p>
            <p><b>Experience:</b> {app.years_experience or '—'}</p>
            <p><b>Resume URL:</b> {app.resume_url or '—'}</p>
            <hr/>
            <p><b>Cover letter:</b><br/>{(app.cover_letter or '').replace(chr(10), '<br/>')}</p>
            """
            resend.Emails.send({
                "from": RESEND_FROM_CAREER,
                "to": [CAREER_INBOX],
                "reply_to": app.email,
                "subject": f"[Careers] {app.job_title} — {app.name}",
                "html": html,
            })
        except Exception as e:  # noqa
            logger.warning("Career email failed: %s", e)

    return {"ok": True, "application_id": app.id}


# ────────────────────────────────────────────────────────────────────────────
# Admin endpoints
# ────────────────────────────────────────────────────────────────────────────
@router.get("/api/admin/careers/jobs")
async def admin_list_jobs(x_admin_email: str = Header(default="")):
    if not _check_admin(x_admin_email):
        raise HTTPException(403, "Admin only")
    cursor = _jobs.find().sort("created_at", -1)
    docs = await cursor.to_list(500)
    return {"jobs": [_from_doc(d) for d in docs]}


@router.post("/api/admin/careers/jobs")
async def admin_create_job(payload: JobCreate, x_admin_email: str = Header(default="")):
    if not _check_admin(x_admin_email):
        raise HTTPException(403, "Admin only")
    job = Job(**payload.model_dump())
    await _jobs.insert_one(_doc(job))
    return _from_doc(await _jobs.find_one({"id": job.id}))


@router.patch("/api/admin/careers/jobs/{job_id}")
async def admin_update_job(job_id: str, payload: JobUpdate, x_admin_email: str = Header(default="")):
    if not _check_admin(x_admin_email):
        raise HTTPException(403, "Admin only")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")
    res = await _jobs.update_one({"id": job_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Job not found")
    return _from_doc(await _jobs.find_one({"id": job_id}))


@router.delete("/api/admin/careers/jobs/{job_id}")
async def admin_delete_job(job_id: str, x_admin_email: str = Header(default="")):
    if not _check_admin(x_admin_email):
        raise HTTPException(403, "Admin only")
    await _jobs.delete_one({"id": job_id})
    return {"ok": True}


@router.get("/api/admin/careers/applications")
async def admin_list_applications(x_admin_email: str = Header(default="")):
    if not _check_admin(x_admin_email):
        raise HTTPException(403, "Admin only")
    cursor = _apps.find().sort("created_at", -1)
    docs = await cursor.to_list(1000)
    return {"applications": [_from_doc(d) for d in docs]}


# ────────────────────────────────────────────────────────────────────────────
# Seed default job postings on startup if collection is empty.
# ────────────────────────────────────────────────────────────────────────────
async def seed_default_jobs():
    if await _jobs.count_documents({}) > 0:
        return
    defaults = [
        Job(
            title="Business Setup Consultant",
            department="Sales & Advisory",
            location="Ajman / Remote-friendly",
            employment_type="Full-time",
            experience="2–4 years",
            salary_range="AED 6,000 – 10,000 / month + commission",
            description="Help founders pick the right UAE jurisdiction. Manage the full lifecycle — from activity match to licence issuance, banking and renewal.",
            responsibilities=[
                "Run discovery calls with founders and recommend the best-fit jurisdiction",
                "Coordinate KYC, MOA, and licence application with freezone authorities",
                "Open bank intros (WIO, Mashreq, RAKBank, ENBD)",
                "Hand over the founder to the lifecycle team after Emirates ID",
            ],
            requirements=[
                "1–3 years UAE business setup / consultancy experience",
                "Working knowledge of IFZA, ANCFZ, SHAMS, RAKEZ, DMCC pricing",
                "Excellent written & spoken English; Arabic is a plus",
            ],
            perks=["Visa + Emirates ID covered", "Performance commission", "Founders Club access"],
        ),
        Job(
            title="Senior Setup Consultant",
            department="Sales & Advisory",
            location="Dubai / Ajman",
            employment_type="Full-time",
            experience="5+ years",
            salary_range="AED 12,000 – 18,000 / month + commission",
            description="Lead complex setups — Golden Visa, mainland LLC, holding structures and multi-entity groups. Mentor junior consultants.",
            responsibilities=[
                "Own complex setup mandates end-to-end",
                "Mentor 2–3 junior consultants",
                "Liaise with DED, ICA, GDRFA and freezone heads directly",
                "Drive Founders Club retention and upsell",
            ],
            requirements=[
                "5+ years UAE business setup / corporate services",
                "Deep familiarity with Golden Visa, Corporate Tax and VAT",
                "Track record closing 30+ setups per year",
            ],
            perks=["Family visa covered", "Quarterly bonus", "Profit-share eligibility"],
        ),
        Job(
            title="Office Coordinator",
            department="Operations",
            location="Ajman, UAE",
            employment_type="Full-time",
            experience="1–2 years",
            salary_range="AED 4,000 – 6,000 / month",
            description="Run the day-to-day office — courier dispatch, document tracking, reception, calendar coordination and supplier follow-ups.",
            responsibilities=[
                "Greet visitors and manage front desk",
                "Track documents — passports, EIDs, originals",
                "Coordinate with PROs, couriers and freezone offices",
                "Maintain office supplies and vendor invoices",
            ],
            requirements=[
                "1–2 years office admin experience (UAE preferred)",
                "Strong English; Arabic, Hindi or Urdu is a plus",
                "MS Office + Google Workspace fluency",
            ],
            perks=["Visa + medical", "Annual leave + flight allowance"],
        ),
        Job(
            title="Full-Stack AI Engineer (UI/UX + Security)",
            department="Engineering",
            location="Remote / Hybrid (UAE preferred)",
            employment_type="Full-time",
            experience="3–6 years",
            salary_range="AED 14,000 – 22,000 / month",
            description="Build and maintain the SmartSetupUAE platform — React + FastAPI + Supabase. Strong UI/UX taste, security-first mindset and comfortable using AI tools (Claude, GPT, Gemini) to ship fast.",
            responsibilities=[
                "Own the SmartSetupUAE front-end (React + Tailwind + Framer Motion)",
                "Ship FastAPI services + Mongo / Supabase data flows",
                "Run weekly security reviews — OWASP Top 10, dependency CVEs, secret scanning",
                "Use AI pair-programming (Claude, GPT, Gemini) to ship 3–5× faster",
            ],
            requirements=[
                "3+ years building production React or Next.js apps",
                "Comfort with FastAPI, Mongo, REST and Supabase",
                "Strong design sense — typography, spacing, motion, accessibility",
                "Hands-on security debugging (CSP, CORS, XSS, SQLi, auth)",
                "Daily AI tooling — Claude Code / GPT / Cursor / Gemini",
            ],
            perks=["Full remote ok", "AI tool stipend (AED 800/mo)", "Equity discussion possible"],
        ),
    ]
    docs = [_doc(j) for j in defaults]
    await _jobs.insert_many(docs)
    logger.info("Seeded %d default job postings", len(docs))
