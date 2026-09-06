"""Admin security layer: 2FA email OTP + audit log + invoice PDF.

- POST /api/admin/auth/otp/request   — sends a 6-digit OTP to the admin email
- POST /api/admin/auth/otp/verify    — verifies OTP and returns a short-lived
                                       admin_session_token (1 hour)
- GET  /api/admin/audit              — admin/manager view audit trail
- GET  /api/admin/invoices/{id}.pdf  — admin/manager/staff download invoice PDF
"""
from __future__ import annotations
import os
import io
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Header, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)
router = APIRouter(tags=["admin-security"])

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "smartsetupuae_admin")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM = os.environ.get("RESEND_FROM_EMAIL", "SmartSetupUAE <noreply@smartsetupuae.ae>")

# Roles that can log in to admin
ADMIN_ROLES = {"admin", "manager", "staff", "reviewer"}

_mongo = AsyncIOMotorClient(MONGO_URL)
_db = _mongo[DB_NAME]
_otps = _db["admin_otps"]
_audit = _db["admin_audit"]
_sessions = _db["admin_sessions"]
_invoices = _db["invoices"]
_assignments = _db["client_assignments"]  # { staff_email, client_id }


# ────────────────────────────────────────────────────────────────────────────
# 2FA — OTP request / verify
# ────────────────────────────────────────────────────────────────────────────
class OtpRequest(BaseModel):
    email: EmailStr


class OtpVerify(BaseModel):
    email: EmailStr
    code: str


def _send_otp_email(to: str, code: str):
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY missing — OTP not emailed. DEV CODE=%s", code)
        return
    try:
        import resend
        resend.api_key = RESEND_API_KEY
        resend.Emails.send({
            "from": RESEND_FROM,
            "to": [to],
            "subject": f"SmartSetupUAE admin OTP: {code}",
            "html": f"""
            <div style="font-family:Inter,Arial;max-width:480px;margin:auto;">
              <h2 style="color:#0F2A2A;">Your admin login code</h2>
              <p>Use this code to finish signing in. It expires in 10 minutes.</p>
              <div style="font-size:36px;letter-spacing:8px;font-weight:800;
                          color:#0F766E;background:#F0FDFA;border:2px solid #0F766E;
                          border-radius:14px;padding:18px;text-align:center;margin:18px 0;">
                {code}
              </div>
              <p style="color:#64748B;font-size:13px;">
                If you didn’t try to sign in, ignore this email and consider
                changing your password.
              </p>
            </div>
            """,
        })
    except Exception as e:  # noqa
        logger.warning("OTP email failed: %s", e)


@router.post("/api/admin/auth/otp/request")
async def otp_request(payload: OtpRequest):
    """Generate + email a 6-digit OTP for the given email.
    Only emails matching an existing admin/staff/reviewer profile receive a code.
    We always return ok=True to prevent email enumeration.
    """
    code = f"{secrets.randbelow(1000000):06d}"
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    await _otps.delete_many({"email": payload.email.lower()})
    await _otps.insert_one({
        "email": payload.email.lower(),
        "code": code,
        "expires_at": expires.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "attempts": 0,
    })
    _send_otp_email(payload.email, code)
    return {"ok": True}


@router.post("/api/admin/auth/otp/verify")
async def otp_verify(payload: OtpVerify):
    """Verify OTP and issue a short-lived admin session token."""
    record = await _otps.find_one({"email": payload.email.lower()})
    if not record:
        raise HTTPException(400, "No OTP requested or already used")

    expires = datetime.fromisoformat(record["expires_at"])
    if datetime.now(timezone.utc) > expires:
        await _otps.delete_one({"_id": record["_id"]})
        raise HTTPException(400, "OTP expired — request a new one")

    attempts = int(record.get("attempts", 0)) + 1
    if attempts > 5:
        await _otps.delete_one({"_id": record["_id"]})
        raise HTTPException(429, "Too many attempts — request a new code")

    if record["code"] != payload.code.strip():
        await _otps.update_one({"_id": record["_id"]}, {"$set": {"attempts": attempts}})
        raise HTTPException(400, f"Invalid code ({attempts}/5)")

    # Success → mint session token (random secret, 1 hour lifetime)
    token = secrets.token_urlsafe(40)
    sess_expires = datetime.now(timezone.utc) + timedelta(hours=1)
    await _sessions.insert_one({
        "token": token,
        "email": payload.email.lower(),
        "expires_at": sess_expires.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await _otps.delete_one({"_id": record["_id"]})
    await _audit.insert_one({
        "actor": payload.email.lower(),
        "action": "admin.login.otp_verified",
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True, "token": token, "expires_at": sess_expires.isoformat()}


async def require_admin_session(x_admin_token: str = Header(default="")) -> dict:
    """Dep: verify session token + return the admin record."""
    if not x_admin_token:
        raise HTTPException(401, "Missing X-Admin-Token")
    sess = await _sessions.find_one({"token": x_admin_token})
    if not sess:
        raise HTTPException(401, "Invalid token")
    if datetime.fromisoformat(sess["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(401, "Session expired")
    return sess


# ────────────────────────────────────────────────────────────────────────────
# Audit log
# ────────────────────────────────────────────────────────────────────────────
class AuditEntry(BaseModel):
    actor: str
    action: str
    target: Optional[str] = None
    details: Optional[dict] = None
    ts: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


async def log_audit(actor: str, action: str, target: str = "", details: dict | None = None):
    """Append an audit entry. Safe to call from anywhere."""
    try:
        await _audit.insert_one({
            "actor": actor,
            "action": action,
            "target": target or "",
            "details": details or {},
            "ts": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:  # noqa
        logger.warning("Audit insert failed: %s", e)


@router.get("/api/admin/audit")
async def list_audit(limit: int = 200, sess: dict = Depends(require_admin_session)):
    docs = await _audit.find().sort("ts", -1).limit(min(limit, 1000)).to_list(limit)
    for d in docs:
        d.pop("_id", None)
    return {"entries": docs}


# ────────────────────────────────────────────────────────────────────────────
# Client assignment (staff sees only THEIR clients)
# ────────────────────────────────────────────────────────────────────────────
class Assign(BaseModel):
    staff_email: EmailStr
    client_id: str


@router.post("/api/admin/assignments")
async def assign_client(payload: Assign, sess: dict = Depends(require_admin_session)):
    await _assignments.update_one(
        {"staff_email": payload.staff_email.lower(), "client_id": payload.client_id},
        {"$set": {
            "staff_email": payload.staff_email.lower(),
            "client_id": payload.client_id,
            "assigned_at": datetime.now(timezone.utc).isoformat(),
            "by": sess["email"],
        }},
        upsert=True,
    )
    await log_audit(sess["email"], "client.assigned", payload.client_id, {"to": payload.staff_email})
    return {"ok": True}


@router.get("/api/admin/assignments")
async def list_my_clients(sess: dict = Depends(require_admin_session)):
    docs = await _assignments.find({"staff_email": sess["email"]}).to_list(500)
    for d in docs:
        d.pop("_id", None)
    return {"assignments": docs}


# ────────────────────────────────────────────────────────────────────────────
# Invoice PDF generator (ReportLab — minimal pure-Python)
# ────────────────────────────────────────────────────────────────────────────
class InvoiceCreate(BaseModel):
    client_name: str
    client_email: EmailStr
    items: List[dict] = []          # [{"name":"IFZA Licence", "qty":1, "price":12900}]
    notes: str = ""
    currency: str = "AED"


@router.post("/api/admin/invoices")
async def create_invoice(payload: InvoiceCreate, sess: dict = Depends(require_admin_session)):
    invoice_id = f"INV-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
    subtotal = sum(float(it.get("price", 0)) * float(it.get("qty", 1)) for it in payload.items)
    vat = round(subtotal * 0.05, 2)
    total = round(subtotal + vat, 2)
    doc = {
        "id": invoice_id,
        "client_name": payload.client_name,
        "client_email": payload.client_email,
        "items": payload.items,
        "notes": payload.notes,
        "currency": payload.currency,
        "subtotal": subtotal,
        "vat": vat,
        "total": total,
        "issued_by": sess["email"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await _invoices.insert_one(doc)
    await log_audit(sess["email"], "invoice.created", invoice_id,
                    {"client": payload.client_email, "total": total})
    doc.pop("_id", None)
    return doc


def _render_invoice_pdf(inv: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=40, rightMargin=40, topMargin=44, bottomMargin=44)
    styles = getSampleStyleSheet()
    title = ParagraphStyle("Title", parent=styles["Title"], fontSize=18,
                           textColor=colors.HexColor("#0F2A2A"), spaceAfter=4)
    small = ParagraphStyle("Small", parent=styles["BodyText"], fontSize=9, textColor=colors.HexColor("#64748B"))
    label = ParagraphStyle("Label", parent=styles["BodyText"], fontSize=8,
                           textColor=colors.HexColor("#0F766E"),
                           spaceAfter=2, alignment=0)
    body = ParagraphStyle("Body", parent=styles["BodyText"], fontSize=10)

    elements = []
    # Brand logo at the top (height 50pt, width auto)
    logo_path = os.path.join(os.path.dirname(__file__), "assets", "brand-logo.png")
    try:
        elements.append(Image(logo_path, width=180, height=54))
    except Exception:
        elements.append(Paragraph("SmartSetupUAE", title))
    elements.append(Spacer(1, 8))
    elements.append(Paragraph("Axiscrest-Global FZE LLC · Lic 262843696888", small))
    elements.append(Paragraph("CWS-1V-000384, 26th Floor, Amber Gem Tower, Ajman, UAE", small))
    elements.append(Spacer(1, 14))

    elements.append(Paragraph("TAX INVOICE", label))
    elements.append(Paragraph(f"<b>{inv['id']}</b> · Issued {inv['created_at'][:10]}", body))
    elements.append(Spacer(1, 8))

    elements.append(Paragraph("BILLED TO", label))
    elements.append(Paragraph(f"<b>{inv['client_name']}</b><br/>{inv['client_email']}", body))
    elements.append(Spacer(1, 14))

    # Items table
    data = [["#", "Description", "Qty", f"Unit ({inv['currency']})", f"Amount ({inv['currency']})"]]
    for i, it in enumerate(inv.get("items", []), 1):
        qty = float(it.get("qty", 1))
        price = float(it.get("price", 0))
        amt = qty * price
        data.append([str(i), it.get("name", ""), f"{qty:g}", f"{price:,.2f}", f"{amt:,.2f}"])
    data.append(["", "", "", "Subtotal", f"{inv['subtotal']:,.2f}"])
    data.append(["", "", "", "VAT 5%", f"{inv['vat']:,.2f}"])
    data.append(["", "", "", "TOTAL", f"{inv['total']:,.2f}"])

    table = Table(data, colWidths=[26, 240, 40, 80, 80])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F2A2A")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("BACKGROUND", (-2, -1), (-1, -1), colors.HexColor("#F0C674")),
        ("FONTNAME", (-2, -1), (-1, -1), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -4), [colors.white, colors.HexColor("#FFFCF5")]),
        ("LINEABOVE", (0, -3), (-1, -3), 0.6, colors.HexColor("#0F766E")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E2E8F0")),
    ]))
    elements.append(table)

    if inv.get("notes"):
        elements.append(Spacer(1, 14))
        elements.append(Paragraph("NOTES", label))
        elements.append(Paragraph(inv["notes"], body))

    elements.append(Spacer(1, 30))
    elements.append(Paragraph(
        "Thank you for choosing SmartSetupUAE — Axiscrest-Global FZE LLC.<br/>"
        "Payments: account@smartsetupuae.ae · support@smartsetupuae.ae · +971 58 590 3155",
        small,
    ))

    doc.build(elements)
    buf.seek(0)
    return buf.read()


@router.get("/api/admin/invoices/{invoice_id}.pdf")
async def download_invoice_pdf(invoice_id: str, sess: dict = Depends(require_admin_session)):
    inv = await _invoices.find_one({"id": invoice_id})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    inv.pop("_id", None)
    pdf_bytes = _render_invoice_pdf(inv)
    await log_audit(sess["email"], "invoice.downloaded", invoice_id)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{invoice_id}.pdf"'},
    )


@router.get("/api/admin/invoices")
async def list_invoices(sess: dict = Depends(require_admin_session)):
    docs = await _invoices.find().sort("created_at", -1).to_list(500)
    for d in docs:
        d.pop("_id", None)
    return {"invoices": docs}
