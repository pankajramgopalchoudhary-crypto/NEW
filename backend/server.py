from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Rate limiter (in-memory; for production use Redis backend)
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])

# Create the main app without a prefix
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)  # hide docs in prod
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds defensive headers to every response.

    Mitigates OWASP A05 (Security Misconfig), A06 (Vulnerable Components reporting),
    clickjacking, MIME sniffing, referrer leakage, and feature exposure.
    """

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        # Don't break SSE streaming
        is_sse = response.headers.get("content-type", "").startswith("text/event-stream")
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(self), camera=()"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        if not is_sse:
            # CSP that allows Supabase + our backend + standard fonts/styles
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com https://*.gstatic.com; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com data:; "
                "img-src 'self' data: blob: https:; "
                "connect-src 'self' https://*.supabase.co https://*.emergentagent.com wss://*.supabase.co; "
                "frame-ancestors 'none'; "
                "form-action 'self'; "
                "base-uri 'self'"
            )
        # Cache hints
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response


app.add_middleware(SecurityHeadersMiddleware)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

# Include the router in the main app
app.include_router(api_router)

# Aria chatbot routes
from aria import router as aria_router  # noqa: E402
app.include_router(aria_router)

# Auth bridge — handles signup + auto-confirm (no SMTP fallback)
from auth_bridge import router as auth_router  # noqa: E402
app.include_router(auth_router)

# Notifications — WhatsApp (Meta Cloud) + Email (Resend)
from notifications import router as notify_router  # noqa: E402
app.include_router(notify_router)

# Download endpoint — exposes /api/download/latest for the project zip
from download import router as download_router  # noqa: E402
app.include_router(download_router)

# Admin user-management API — role hierarchy enforced (admin > manager > staff/reviewer)
from admin_users import router as admin_users_router  # noqa: E402
app.include_router(admin_users_router)

# AI OCR for passports, EIDs, licenses, etc.
from ocr import router as ocr_router  # noqa: E402
app.include_router(ocr_router)

# Selfie → passport-ready photo (Nano Banana)
from photo import router as photo_router  # noqa: E402
app.include_router(photo_router)

# Admin live editor for freezone_packages (CRUD via Supabase service role)
from admin_packages import router as admin_pkg_router  # noqa: E402
app.include_router(admin_pkg_router)

# Support tickets — Aria-first, live-agent-second
from support import router as support_router  # noqa: E402
app.include_router(support_router)

# Founder portal lifecycle — progress / appointments / vault / compliance / renewals / invoices
from lifecycle import router as lifecycle_router  # noqa: E402
app.include_router(lifecycle_router)

# Multi-currency Stripe payments & exchange rates
from payments import router as payments_router  # noqa: E402
app.include_router(payments_router)

# Admin extras — dummy seeding & dashboard stats
from admin_extras import router as admin_extras_router  # noqa: E402
app.include_router(admin_extras_router)

# Branded PDF guides (Golden Visa, etc.) — Axiscrest-Global FZE LLC
from guides import router as guides_router  # noqa: E402
app.include_router(guides_router)

# 7 lifecycle notification triggers (WhatsApp + Resend email)
from notify_router import router as notify_trig_router  # noqa: E402
app.include_router(notify_trig_router)

# Referral engine (AED 50 cashback + 5% off next renewal per converted invite)
from referral import router as referral_router  # noqa: E402
app.include_router(referral_router)

# Careers — public job listings + applications, with admin management
from careers import router as careers_router, seed_default_jobs  # noqa: E402
app.include_router(careers_router)

# Admin security: 2FA email OTP, audit log, invoice PDFs, client assignments
from admin_security import router as admin_sec_router  # noqa: E402
app.include_router(admin_sec_router)

# Central email logs + Resend webhook + SLA + AI support (extension platform)
from email_logs import router as email_logs_router, ensure_indexes as _email_indexes  # noqa: E402
app.include_router(email_logs_router)

from webhooks_resend import router as webhooks_resend_router  # noqa: E402
app.include_router(webhooks_resend_router)

from sla import router as sla_router, ensure_defaults as _sla_defaults  # noqa: E402
app.include_router(sla_router)

from ai_support import router as ai_support_router, ensure_defaults as _ai_defaults  # noqa: E402
app.include_router(ai_support_router)


@app.on_event("startup")
async def _init_extension_platform():
    for fn in (_email_indexes, _sla_defaults, _ai_defaults):
        try:
            await fn()
        except Exception as e:
            logging.getLogger(__name__).warning("[startup] init failed for %s: %s", fn.__name__, e)


@app.on_event("startup")
async def _seed_careers():
    try:
        await seed_default_jobs()
    except Exception as e:  # noqa
        logging.getLogger(__name__).warning("Career seed skipped: %s", e)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "https://uae-formation-beta.preview.emergentagent.com",
        "https://smartsetupuae.ae",
        "https://www.smartsetupuae.ae",
        "http://localhost:3000",  # local dev only
    ] if os.environ.get("CORS_STRICT", "0") == "1" else os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "apikey", "X-Client-Info"],
    max_age=86400,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()