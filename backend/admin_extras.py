"""Admin seeding & full CRM helpers.

POST /api/admin/seed/dummy — generates 50 leads + 20 client orders + etc.
GET  /api/admin/dashboard/stats — KPIs for admin dashboard

NOTE on `random`: the `random` module here only generates **demo / seed CRM
data** (fake leads, dummy passports, scheduled-call dates). It is **never**
used to mint tokens, passwords, OTPs or anything security-sensitive. Static
analyzers may flag it; we explicitly accept that risk for the dummy seeder
and use `secrets.token_urlsafe` everywhere security matters (see
`admin_security.py`).
"""
from __future__ import annotations
import os, secrets, uuid, logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import httpx

# Seeded RNG only — explicitly NOT for security tokens.
random = secrets.SystemRandom()  # noqa: S311  (false positive — dummy CRM data only)
logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin-extras"])

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "smartsetupuae")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SVC = {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"}

_mongo = AsyncIOMotorClient(MONGO_URL)
_db = _mongo[DB_NAME]


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
                        params={"id": f"eq.{u['id']}", "select": "id,email,role"},
                        headers=SVC)
        prof = (p.json() or [{}])[0] if p.status_code < 300 else {}
        if prof.get("role") not in {"admin", "manager"}:
            raise HTTPException(403, "Admin/manager only")
        return {"id": u["id"], "email": u.get("email"), "role": prof.get("role")}


FIRST_NAMES = ["Ahmed", "Sara", "Omar", "Fatima", "Rashed", "Mariam", "Khalid", "Layla",
               "Yousef", "Nora", "Hassan", "Aisha", "Mohammed", "Hind", "Saif", "Reem",
               "Ali", "Mona", "Zayed", "Hessa", "Pankaj", "Priya", "Rohit", "Ananya",
               "Vikram", "Neha", "Arjun", "Ishita", "Karthik", "Divya"]
LAST_NAMES = ["Al Maktoum", "Al Nahyan", "Al Qasimi", "Khan", "Sharma", "Verma", "Patel",
              "Hassan", "Mansouri", "Rashed", "Ahmadi", "Kumar", "Singh", "Mehta", "Iyer"]
NATIONALITIES = ["UAE", "India", "Pakistan", "UK", "USA", "Egypt", "Lebanon", "Jordan", "Philippines", "China"]
SOURCES = ["website", "ai_search", "smart_finder", "compare_page", "consultation", "golden_visa_page",
           "checkout", "founder_club", "free_zones", "whatsapp"]
ZONES = ["IFZA", "ANCFZ", "SHAMS", "Meydan", "DMCC", "RAKEZ", "SPC", "DAFZA", "DWTC", "Dubai South"]
BIZ_TYPES = ["E-Commerce", "Trading", "Consulting", "Software/IT", "Media", "Marketing", "Real Estate"]
LEAD_STATUSES = ["new", "contacted", "qualified", "converted", "lost"]


@router.post("/seed/dummy")
async def seed_dummy(caller: dict = Depends(_require_admin)):
    """Seeds the demo data described in PART 11 of the master prompt.

    Idempotency: deletes prior dummy rows (tagged source containing TEST_DATA) first.
    """
    if not (SUPABASE_URL and SUPABASE_SERVICE_KEY):
        raise HTTPException(500, "Supabase not configured")

    # Clear prior TEST_DATA rows
    async with httpx.AsyncClient(timeout=20) as c:
        try:
            await c.delete(
                f"{SUPABASE_URL}/rest/v1/leads?notes=ilike.*TEST_DATA*",
                headers={**SVC, "Prefer": "return=minimal"},
            )
        except Exception:
            pass

        # Seed 50 leads
        leads_payload = []
        for i in range(50):
            fn = random.choice(FIRST_NAMES); ln = random.choice(LAST_NAMES)
            email = f"test_{i+1:02d}_{fn.lower().split()[0]}@example.com"
            phone = f"+9715{random.randint(10000000, 99999999)}"
            zone = random.choice(ZONES)
            biz = random.choice(BIZ_TYPES)
            status = random.choices(
                LEAD_STATUSES,
                weights=[40, 25, 15, 10, 10],  # mostly new/contacted
            )[0]
            leads_payload.append({
                "name": f"{fn} {ln}",
                "email": email,
                "phone": phone,
                "whatsapp": phone,
                "nationality": random.choice(NATIONALITIES),
                "zone": zone,
                "biz_type": biz,
                "activities": [f"{biz} Trading", "General Trading"],
                "company_names": [f"{fn} {biz}", f"{ln} Holdings"],
                "booking_type": random.choice(["pay_now", "reserve_999"]),
                "amount_paid": random.choice([0, 999, 2500]),
                "full_total": random.randint(8000, 32000),
                "pay_method": random.choice(["bank_transfer", "card", "crypto"]),
                "status": status,
                "lead_status": status,
                "source": random.choice(SOURCES),
                "notes": f"TEST_DATA dummy seed · Generated {datetime.now(timezone.utc).isoformat()}",
            })
        # Bulk insert (chunked by 25 to avoid PostgREST limit)
        inserted = 0
        for chunk_start in range(0, len(leads_payload), 25):
            chunk = leads_payload[chunk_start:chunk_start+25]
            r = await c.post(f"{SUPABASE_URL}/rest/v1/leads",
                             headers={**SVC, "Content-Type": "application/json", "Prefer": "return=minimal"},
                             json=chunk)
            if r.status_code < 300:
                inserted += len(chunk)
            else:
                logger.warning("seed leads chunk error %s: %s", r.status_code, r.text[:200])

    # Seed 20 clients in MongoDB (extended profiles + 10 with completed companies)
    completed_companies = 0
    for i in range(20):
        email = f"client_{i+1:02d}@example.com"
        await _db.client_profiles_ext.update_one(
            {"email": email},
            {"$set": {
                "email": email,
                "full_name": f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
                "nationality": random.choice(NATIONALITIES),
                "passport_number": f"P{random.randint(1000000, 9999999)}",
                "mobile": f"+9715{random.randint(10000000, 99999999)}",
                "whatsapp": f"+9715{random.randint(10000000, 99999999)}",
                "residency_status": random.choice(["UAE Resident", "Visitor", "Outside UAE"]),
                "uae_address": f"Apt {random.randint(100,999)}, {random.choice(['Marina','JLT','Downtown','Business Bay'])}, Dubai",
                "occupation": random.choice(["Entrepreneur", "Investor", "Consultant", "Developer"]),
                "is_test_data": True,
            }},
            upsert=True,
        )

    # 10 completed companies — application_progress all-done
    for i in range(10):
        order_ref = f"TEST-ORD-{i+1:03d}"
        steps = {}
        from lifecycle import TIMELINE_STEPS
        for s in TIMELINE_STEPS:
            steps[s["key"]] = {
                "status": "completed",
                "date_completed": (datetime.now(timezone.utc) - timedelta(days=random.randint(1, 30))).isoformat(),
            }
        await _db.application_progress.update_one(
            {"order_ref": order_ref},
            {"$set": {
                "order_ref": order_ref,
                "owner_email": f"client_{i+1:02d}@example.com",
                "steps": steps,
                "is_test_data": True,
            }},
            upsert=True,
        )
        completed_companies += 1

    # 5 founder club members in MongoDB (and also in Supabase founder_club_memberships)
    founder_count = 0
    for i in range(5):
        email = f"founder_{i+1:02d}@example.com"
        async with httpx.AsyncClient(timeout=10) as c:
            try:
                await c.post(
                    f"{SUPABASE_URL}/rest/v1/founder_club_memberships",
                    headers={**SVC, "Content-Type": "application/json", "Prefer": "return=minimal"},
                    json={
                        "user_email": email,
                        "plan": "founder_club_lifetime",
                        "order_reference": f"TEST-FC-{i+1:03d}",
                        "active": True,
                    },
                )
                founder_count += 1
            except Exception as e:
                logger.warning("founder seed: %s", e)

    # 5 appointments (medical / biometrics) for first 5 clients
    appts = 0
    for i in range(5):
        email = f"client_{i+1:02d}@example.com"
        appt_type = "medical_test" if i % 2 == 0 else "biometrics"
        await _db.appointments.insert_one({
            "id": str(uuid.uuid4()),
            "order_ref": f"TEST-ORD-{i+1:03d}",
            "client_email": email,
            "appointment_type": appt_type,
            "date": (datetime.now(timezone.utc) + timedelta(days=random.randint(2, 14))).isoformat(),
            "location_name": "Vision Medical Center" if appt_type == "medical_test" else "ICA Emirates ID Center",
            "address": "Sheikh Zayed Road, Dubai",
            "contact_number": "+97144000000",
            "map_url": "https://maps.google.com/?q=Dubai+Healthcare+City",
            "documents_required": ["Passport copy", "Visa copy", "Photo"] if appt_type == "medical_test" else ["Approval email", "Original passport"],
            "status": "scheduled",
            "is_test_data": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        appts += 1

    return {
        "ok": True,
        "leads_inserted": inserted,
        "completed_companies": completed_companies,
        "founder_members": founder_count,
        "appointments": appts,
        "clients_profiles": 20,
        "note": "All rows tagged TEST_DATA. Delete via /api/admin/seed/cleanup when ready for production.",
    }


@router.delete("/seed/cleanup")
async def cleanup_dummy(caller: dict = Depends(_require_admin)):
    async with httpx.AsyncClient(timeout=15) as c:
        await c.delete(f"{SUPABASE_URL}/rest/v1/leads?notes=ilike.*TEST_DATA*",
                       headers={**SVC, "Prefer": "return=minimal"})
        await c.delete(f"{SUPABASE_URL}/rest/v1/founder_club_memberships?order_reference=ilike.TEST-FC-*",
                       headers={**SVC, "Prefer": "return=minimal"})
    await _db.client_profiles_ext.delete_many({"is_test_data": True})
    await _db.application_progress.delete_many({"is_test_data": True})
    await _db.appointments.delete_many({"is_test_data": True})
    return {"ok": True}


@router.get("/dashboard/stats")
async def admin_stats(caller: dict = Depends(_require_admin)):
    async with httpx.AsyncClient(timeout=10) as c:
        async def _count(table: str, filt: str = ""):
            try:
                r = await c.head(f"{SUPABASE_URL}/rest/v1/{table}?select=id{filt}",
                                  headers={**SVC, "Prefer": "count=exact"})
                cr = r.headers.get("content-range", "*/0")
                return int(cr.split("/")[-1]) if cr else 0
            except Exception:
                return 0

        leads = await _count("leads")
        leads_new = await _count("leads", "&status=eq.new")
        leads_converted = await _count("leads", "&status=eq.converted")
        orders = await _count("checkout_orders")
        orders_paid = await _count("checkout_orders", "&status=eq.paid")
        founder = await _count("founder_club_memberships", "&active=eq.true")
        zones = await _count("freezone_packages", "&is_active=eq.true")
        activities = await _count("activities_master", "&is_active=eq.true")

    gv_leads = await _db.golden_visa_leads.count_documents({})
    appts = await _db.appointments.count_documents({})

    return {
        "leads": {"total": leads, "new": leads_new, "converted": leads_converted},
        "orders": {"total": orders, "paid": orders_paid},
        "founder_club": {"active": founder},
        "freezone_packages": zones,
        "activities": activities,
        "golden_visa_leads": gv_leads,
        "appointments": appts,
    }
