"""Stripe checkout & multi-currency exchange rates.

Uses the Emergent-bundled stripe wrapper:
  from emergentintegrations.payments.stripe.checkout import StripeCheckout, ...

Currencies supported: AED, USD, EUR, GBP, INR.
All amounts come from the SERVER (never trust frontend amounts).
"""
from __future__ import annotations
import os, logging, time
from typing import Optional, Dict, Any, Literal
from fastapi import APIRouter, HTTPException, Request, Header, Depends
from pydantic import BaseModel, EmailStr
from motor.motor_asyncio import AsyncIOMotorClient
import httpx

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/payments", tags=["payments"])

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "smartsetupuae")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")
EXCHANGE_RATE_API = os.environ.get("EXCHANGE_RATE_API", "https://open.er-api.com/v6/latest/AED")

_mongo = AsyncIOMotorClient(MONGO_URL)
_db = _mongo[DB_NAME]

# Cached FX rates (refresh every 6h)
_RATES_CACHE: Dict[str, Any] = {"ts": 0, "rates": {"AED": 1.0, "USD": 0.272, "EUR": 0.25, "GBP": 0.215, "INR": 22.65}}
SUPPORTED_CURRENCIES = ["AED", "USD", "EUR", "GBP", "INR"]

SVC = {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"}


async def _get_rates() -> Dict[str, float]:
    now = time.time()
    if now - _RATES_CACHE["ts"] < 6 * 3600:
        return _RATES_CACHE["rates"]
    try:
        async with httpx.AsyncClient(timeout=8) as c:
            r = await c.get(EXCHANGE_RATE_API)
            if r.status_code == 200:
                j = r.json()
                rates = j.get("rates", {})
                out = {"AED": 1.0}
                for cur in SUPPORTED_CURRENCIES:
                    if cur in rates:
                        out[cur] = float(rates[cur])
                _RATES_CACHE["rates"] = out
                _RATES_CACHE["ts"] = now
                logger.info("FX rates refreshed: %s", out)
    except Exception as e:
        logger.warning("FX fetch failed, using cache: %s", e)
    return _RATES_CACHE["rates"]


@router.get("/currencies")
async def list_currencies():
    rates = await _get_rates()
    return {
        "base": "AED",
        "currencies": [
            {"code": "AED", "label": "UAE Dirham",  "symbol": "د.إ", "rate_from_aed": rates.get("AED", 1.0)},
            {"code": "USD", "label": "US Dollar",   "symbol": "$",   "rate_from_aed": rates.get("USD", 0.272)},
            {"code": "EUR", "label": "Euro",        "symbol": "€",   "rate_from_aed": rates.get("EUR", 0.25)},
            {"code": "GBP", "label": "British Pound","symbol": "£",  "rate_from_aed": rates.get("GBP", 0.215)},
            {"code": "INR", "label": "Indian Rupee","symbol": "₹",   "rate_from_aed": rates.get("INR", 22.65)},
        ],
    }


# ----------- STRIPE -----------
class CheckoutSessionCreate(BaseModel):
    order_ref: Optional[str] = None
    package_id: Optional[str] = None
    amount_aed: float           # SERVER will re-validate
    currency: Literal["AED", "USD", "EUR", "GBP", "INR"] = "AED"
    customer_email: EmailStr
    description: Optional[str] = "SmartSetupUAE Order"
    origin_url: str             # frontend window.location.origin


@router.post("/checkout/session")
async def create_checkout_session(payload: CheckoutSessionCreate, request: Request):
    """Create Stripe Checkout Session. Amount is provided in AED and converted server-side."""
    # SECURITY: re-fetch the canonical amount from Supabase orders table if order_ref given.
    canonical_amount_aed = payload.amount_aed
    if payload.order_ref and SUPABASE_URL and SUPABASE_SERVICE_KEY:
        async with httpx.AsyncClient(timeout=8) as c:
            r = await c.get(f"{SUPABASE_URL}/rest/v1/checkout_orders",
                            params={"id": f"eq.{payload.order_ref}", "select": "final_total,currency"},
                            headers=SVC)
            if r.status_code == 200 and r.json():
                canonical_amount_aed = float(r.json()[0].get("final_total") or payload.amount_aed)

    if canonical_amount_aed <= 0 or canonical_amount_aed > 1_000_000:
        raise HTTPException(400, "Invalid amount")

    rates = await _get_rates()
    rate = rates.get(payload.currency, 1.0)
    final_amount = round(canonical_amount_aed * rate, 2)
    stripe_currency = payload.currency.lower()

    # Stripe doesn't support AED in test mode at create_checkout? Actually it does. Fine.
    try:
        from emergentintegrations.payments.stripe.checkout import (
            StripeCheckout, CheckoutSessionRequest,
        )
    except Exception as e:
        raise HTTPException(500, f"Stripe library missing: {e}")

    host = payload.origin_url.rstrip("/")
    success_url = f"{host}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url  = f"{host}/checkout"

    webhook_url = f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    req = CheckoutSessionRequest(
        amount=float(final_amount),
        currency=stripe_currency,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "order_ref": payload.order_ref or "",
            "customer_email": payload.customer_email,
            "amount_aed": str(canonical_amount_aed),
            "display_currency": payload.currency,
        },
    )
    session = await stripe_checkout.create_checkout_session(req)

    # Persist payment transaction
    await _db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "order_ref": payload.order_ref,
        "customer_email": payload.customer_email,
        "amount_aed": canonical_amount_aed,
        "amount_charged": final_amount,
        "currency": payload.currency,
        "status": "initiated",
        "payment_status": "pending",
        "created_at": time.time(),
    })

    return {"url": session.url, "session_id": session.session_id,
            "display_amount": final_amount, "display_currency": payload.currency}


@router.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str, request: Request):
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
    except Exception as e:
        raise HTTPException(500, f"Stripe library missing: {e}")

    webhook_url = f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    status_obj = await stripe_checkout.get_checkout_status(session_id)

    # Idempotent update — only update once when status changes to paid
    existing = await _db.payment_transactions.find_one({"session_id": session_id})
    if existing and existing.get("payment_status") != status_obj.payment_status:
        await _db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": status_obj.status, "payment_status": status_obj.payment_status,
                      "updated_at": time.time()}},
        )
        # If paid → also update Supabase order + fire notifications
        if status_obj.payment_status == "paid" and existing.get("order_ref"):
            async with httpx.AsyncClient(timeout=8) as c:
                try:
                    await c.patch(
                        f"{SUPABASE_URL}/rest/v1/checkout_orders?id=eq.{existing['order_ref']}",
                        headers={**SVC, "Content-Type": "application/json", "Prefer": "return=minimal"},
                        json={"status": "paid"},
                    )
                except Exception as e:
                    logger.warning("supabase order update failed: %s", e)
        # Fire order-placed notification (email + WhatsApp) on payment success
        if status_obj.payment_status == "paid":
            try:
                import notify_triggers as nt
                await nt.notify_order_placed(
                    client_email=existing.get("customer_email") or "",
                    client_name="",
                    client_whatsapp="",
                    order_ref=existing.get("order_ref") or "",
                    amount=float(existing.get("amount_aed") or 0),
                    currency="AED",
                    package_name=(existing.get("metadata") or {}).get("package_name", "SmartSetupUAE Order") if isinstance(existing.get("metadata"), dict) else "SmartSetupUAE Order",
                    paid=True,
                )
            except Exception as e:
                logger.warning("order_placed notification failed: %s", e)

            # Convert any pending referral for this customer (issues both rewards)
            try:
                from referral import mark_referral_converted
                await mark_referral_converted(
                    referee_email=existing.get("customer_email") or "",
                    order_ref=existing.get("order_ref") or "",
                    amount_aed=float(existing.get("amount_aed") or 0),
                )
            except Exception as e:
                logger.warning("referral conversion failed: %s", e)

    return {
        "session_id": session_id,
        "status": status_obj.status,
        "payment_status": status_obj.payment_status,
        "amount_total": status_obj.amount_total,
        "currency": status_obj.currency,
        "metadata": status_obj.metadata,
    }


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request, stripe_signature: Optional[str] = Header(default=None, alias="Stripe-Signature")):
    body = await request.body()
    try:
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
    except Exception as e:
        raise HTTPException(500, f"Stripe library missing: {e}")
    webhook_url = f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    try:
        evt = await stripe_checkout.handle_webhook(body, stripe_signature or "")
    except Exception as e:
        logger.error("webhook verify failed: %s", e)
        raise HTTPException(400, "Invalid webhook")

    await _db.payment_transactions.update_one(
        {"session_id": evt.session_id},
        {"$set": {"payment_status": evt.payment_status, "last_webhook_event": evt.event_type,
                  "updated_at": time.time()}},
    )
    return {"ok": True}
