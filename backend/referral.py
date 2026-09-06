"""Referral Engine — every client gets a unique referral code; when their friend
signs up + makes their first paid order, both sides earn a reward.

Rewards (configurable in REFERRAL_REWARDS env override, defaults below):
  - Referrer (existing client): AED 50 cashback credit OR 5% off next renewal (their choice)
  - Referee (new signup): AED 50 off first order

Storage (MongoDB):
  - referral_codes:  { code, owner_email, owner_name, created_at, total_invites, total_converted }
  - referrals:       { id, code, referee_email, referee_name, status: pending|signed_up|converted, signed_up_at, converted_at, reward_amount, reward_kind }
  - referral_rewards:{ id, owner_email, kind: cashback|discount_percent, amount, currency, source_referral_id, redeemed: bool, created_at }
"""
from __future__ import annotations
import os, uuid, secrets, string, logging
from datetime import datetime, timezone
from typing import Optional, Literal, List, Dict, Any
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel, EmailStr
from motor.motor_asyncio import AsyncIOMotorClient
import httpx

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/referral", tags=["referral"])

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "smartsetupuae")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BRAND_URL = "https://smartsetupuae.ae"

REFERRER_CASHBACK_AED = float(os.environ.get("REFERRAL_REFERRER_CASHBACK", "50"))
REFERRER_PERCENT_OFF = float(os.environ.get("REFERRAL_REFERRER_PERCENT", "5"))
REFEREE_CASHBACK_AED = float(os.environ.get("REFERRAL_REFEREE_CASHBACK", "50"))

_mongo = AsyncIOMotorClient(MONGO_URL)
_db = _mongo[DB_NAME]
SVC = {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"}


# -------------- AUTH HELPER (Supabase JWT) --------------
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
        p = await c.get(f"{SUPABASE_URL}/rest/v1/profiles",
                        params={"id": f"eq.{u['id']}", "select": "id,email,role,full_name"},
                        headers=SVC)
        prof = (p.json() or [{}])[0] if p.status_code < 300 else {}
        return {"id": u["id"], "email": u.get("email"), "role": prof.get("role") or "client",
                "full_name": prof.get("full_name") or ""}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _make_code(name: str) -> str:
    """Vanity code like SARA-X4F7 (first name + 4-char nonce)."""
    base = "".join([c for c in (name or "").upper() if c.isalpha()])[:6] or "FOUNDER"
    nonce = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(4))
    return f"{base}-{nonce}"


# -------------- 1. GET MY REFERRAL CODE (auto-create) --------------
@router.get("/me")
async def my_referral(user: dict = Depends(get_user)):
    doc = await _db.referral_codes.find_one({"owner_email": user["email"]}, {"_id": 0})
    if not doc:
        code = _make_code(user.get("full_name") or user["email"].split("@")[0])
        # Ensure uniqueness
        for _ in range(5):
            if not await _db.referral_codes.find_one({"code": code}):
                break
            code = _make_code(user.get("full_name") or "founder")
        doc = {
            "code": code,
            "owner_email": user["email"],
            "owner_name": user.get("full_name") or "",
            "created_at": _now(),
            "total_invites": 0,
            "total_converted": 0,
        }
        await _db.referral_codes.insert_one(dict(doc))
        doc.pop("_id", None)

    # Pull current stats
    invites = await _db.referrals.count_documents({"code": doc["code"]})
    converted = await _db.referrals.count_documents({"code": doc["code"], "status": "converted"})
    pending_rewards = await _db.referral_rewards.find(
        {"owner_email": user["email"], "redeemed": False}, {"_id": 0}
    ).to_list(50)

    return {
        "code": doc["code"],
        "share_url": f"{BRAND_URL}/?ref={doc['code']}",
        "invites": invites,
        "converted": converted,
        "rewards": {
            "earned_cashback_aed": sum(r["amount"] for r in pending_rewards if r["kind"] == "cashback"),
            "available_percent_off": REFERRER_PERCENT_OFF if any(r["kind"] == "discount_percent" for r in pending_rewards) else 0,
            "items": pending_rewards,
        },
        "rules": {
            "referrer_cashback_aed": REFERRER_CASHBACK_AED,
            "referrer_percent_off": REFERRER_PERCENT_OFF,
            "referee_cashback_aed": REFEREE_CASHBACK_AED,
            "valid_for": "First paid order. Lifetime — no cap on number of friends.",
        },
    }


# -------------- 2. PUBLIC LOOKUP (used at signup/checkout to validate a code) --------------
@router.get("/lookup/{code}")
async def lookup_code(code: str):
    doc = await _db.referral_codes.find_one({"code": code.upper()}, {"_id": 0, "owner_email": 0})
    if not doc:
        raise HTTPException(404, "Invalid referral code")
    return {
        "code": doc["code"],
        "referee_discount_aed": REFEREE_CASHBACK_AED,
        "valid": True,
    }


# -------------- 3. ATTACH CODE TO SIGNUP (no auth — called from /signup or /checkout) --------------
class AttachIn(BaseModel):
    code: str
    referee_email: EmailStr
    referee_name: Optional[str] = ""


@router.post("/attach")
async def attach_referral(body: AttachIn):
    code = body.code.upper().strip()
    parent = await _db.referral_codes.find_one({"code": code})
    if not parent:
        raise HTTPException(404, "Invalid referral code")
    if parent["owner_email"].lower() == body.referee_email.lower():
        raise HTTPException(400, "Cannot refer yourself")

    # Skip if already attached
    exist = await _db.referrals.find_one({"code": code, "referee_email": body.referee_email.lower()})
    if exist:
        return {"ok": True, "already_attached": True, "id": exist["id"]}

    ref = {
        "id": str(uuid.uuid4()),
        "code": code,
        "referrer_email": parent["owner_email"],
        "referee_email": body.referee_email.lower(),
        "referee_name": body.referee_name or "",
        "status": "signed_up",
        "signed_up_at": _now(),
        "converted_at": None,
        "reward_amount": 0,
        "reward_kind": "",
    }
    await _db.referrals.insert_one(ref)
    await _db.referral_codes.update_one({"code": code}, {"$inc": {"total_invites": 1}})
    return {"ok": True, "id": ref["id"], "referee_discount_aed": REFEREE_CASHBACK_AED}


# -------------- 4. MARK CONVERTED (called server-side when payment succeeds) --------------
async def mark_referral_converted(*, referee_email: str, order_ref: str = "", amount_aed: float = 0) -> Optional[Dict[str, Any]]:
    """Idempotent: if referee has a pending referral, mark it converted and credit both sides."""
    ref = await _db.referrals.find_one({"referee_email": referee_email.lower(), "status": {"$ne": "converted"}})
    if not ref:
        return None
    code = ref["code"]
    referrer_email = ref["referrer_email"]
    await _db.referrals.update_one(
        {"id": ref["id"]},
        {"$set": {"status": "converted", "converted_at": _now(),
                  "reward_amount": REFERRER_CASHBACK_AED, "reward_kind": "cashback",
                  "order_ref": order_ref, "order_amount_aed": amount_aed}},
    )
    await _db.referral_codes.update_one({"code": code}, {"$inc": {"total_converted": 1}})

    # Issue rewards
    await _db.referral_rewards.insert_one({
        "id": str(uuid.uuid4()),
        "owner_email": referrer_email,
        "kind": "cashback",
        "amount": REFERRER_CASHBACK_AED,
        "currency": "AED",
        "source_referral_id": ref["id"],
        "redeemed": False,
        "created_at": _now(),
    })
    # Also unlock the "5% off next renewal" option
    await _db.referral_rewards.insert_one({
        "id": str(uuid.uuid4()),
        "owner_email": referrer_email,
        "kind": "discount_percent",
        "amount": REFERRER_PERCENT_OFF,
        "currency": "%",
        "source_referral_id": ref["id"],
        "redeemed": False,
        "created_at": _now(),
    })

    # Notify referrer (email + WhatsApp) using existing trigger system
    try:
        import notify_triggers as nt  # local import to avoid cycle
        await nt.notify_founder_club(  # reuse the cheerful template
            client_email=referrer_email,
            client_name="",
            client_whatsapp="",
            expiry_date=f"You just earned AED {REFERRER_CASHBACK_AED:.0f} cashback + {REFERRER_PERCENT_OFF}% off your next renewal",
        )
    except Exception as e:
        logger.warning("referral reward notification failed: %s", e)

    return {"referrer_email": referrer_email, "code": code,
            "cashback_aed": REFERRER_CASHBACK_AED,
            "percent_off": REFERRER_PERCENT_OFF}


# -------------- 5. ADMIN: list all referrals --------------
@router.get("/admin/list")
async def admin_list(user: dict = Depends(get_user)):
    if user["role"] not in {"admin", "manager", "staff"}:
        raise HTTPException(403, "Staff only")
    refs = await _db.referrals.find({}, {"_id": 0}).sort("signed_up_at", -1).to_list(500)
    codes = await _db.referral_codes.find({}, {"_id": 0}).sort("total_converted", -1).to_list(500)
    return {"referrals": refs, "codes": codes}


# -------------- 6. ADMIN: redeem reward (mark as used) --------------
@router.patch("/admin/reward/{reward_id}/redeem")
async def admin_redeem(reward_id: str, user: dict = Depends(get_user)):
    if user["role"] not in {"admin", "manager"}:
        raise HTTPException(403, "Admin only")
    await _db.referral_rewards.update_one(
        {"id": reward_id}, {"$set": {"redeemed": True, "redeemed_at": _now(), "redeemed_by": user["email"]}}
    )
    return {"ok": True}
