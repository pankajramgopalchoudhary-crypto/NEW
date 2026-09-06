"""Server-side order creation with immutable price snapshots.

The browser NEVER sends prices. It sends *what* it wants to buy (package id,
service slugs, addon ids, coupon code) and the server re-prices everything
from the canonical sources:

  * standalone services  -> Mongo `service_catalog`
  * freezone packages    -> Supabase `freezone_packages`
  * addons               -> Supabase `service_addons` / `package_addons`
  * coupons              -> Supabase `coupons`

The resulting line items are snapshotted into Mongo `order_snapshots`, and the
order row is written to Supabase `checkout_orders` with the service role key.
"""
from __future__ import annotations

import os
import logging
import random
import string
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

import httpx
from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

from services_catalog import get_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/orders", tags=["orders"])

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SVC = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
}

_mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
_db = _mongo[os.environ["DB_NAME"]]
snapshots = _db["order_snapshots"]

PACKAGE_PRICE_KEYS = [
    "display_price", "promotion_price", "discount_price", "offer_price",
    "package_price", "base_price", "original_price", "price",
]
ADDON_PRICE_KEYS = ["price", "display_price", "amount"]
MAX_ORDER_AED = 1_000_000


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _money(value: Any, fallback: float = 0.0) -> float:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return fallback
    return n if n == n else fallback  # NaN guard


def _first_price(row: Dict[str, Any], keys: List[str]) -> float:
    for key in keys:
        if row.get(key) not in (None, "", 0, "0"):
            price = _money(row.get(key))
            if price > 0:
                return price
    return 0.0


def _reference() -> str:
    day = datetime.now(timezone.utc).strftime("%Y%m%d")
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=5))
    return f"SSU-{day}-{suffix}"


async def _sb_get(table: str, params: Dict[str, str]) -> List[Dict[str, Any]]:
    async with httpx.AsyncClient(timeout=12) as c:
        r = await c.get(f"{SUPABASE_URL}/rest/v1/{table}", params=params, headers=SVC)
    if r.status_code != 200:
        logger.warning("supabase GET %s failed %s: %s", table, r.status_code, r.text[:300])
        return []
    return r.json() or []


# ----------------------------------------------------------------- models
class OrderItemIn(BaseModel):
    kind: Literal["service", "package", "addon"]
    slug: Optional[str] = None          # service slug
    package_id: Optional[str] = None    # Supabase freezone_packages.id
    addon_id: Optional[str] = None      # Supabase addon id
    freezone: Optional[str] = None      # package fallback lookup
    package_name: Optional[str] = None  # package fallback lookup
    addon_name: Optional[str] = None    # addon fallback lookup
    qty: int = Field(default=1, ge=1, le=50)


class ContactIn(BaseModel):
    name: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = None
    phone_code: Optional[str] = None


class OrderIn(BaseModel):
    items: List[OrderItemIn]
    contact: ContactIn
    business: Dict[str, Any] = Field(default_factory=dict)
    zone_name: Optional[str] = None
    zone_slug: Optional[str] = None
    package_name: Optional[str] = None
    duration_years: Optional[float] = 1
    visa_count: Optional[float] = 0
    office_type: Optional[str] = None
    coupon_code: Optional[str] = None
    user_id: Optional[str] = None


# ----------------------------------------------------------------- pricing
async def _price_service(item: OrderItemIn) -> Dict[str, Any]:
    if not item.slug:
        raise HTTPException(400, "service item requires a slug")
    svc = await get_service(item.slug)
    if not svc:
        raise HTTPException(400, f"Unknown or inactive service: {item.slug}")
    unit = _money(svc.get("price_aed"))
    if unit <= 0:
        raise HTTPException(400, f"Service {item.slug} has no valid price")
    return {
        "kind": "service",
        "ref": svc["slug"],
        "name": svc.get("name") or svc["slug"],
        "billing": svc.get("billing") or "one-time",
        "price_label": svc.get("price_label") or f"AED {unit:,.0f}",
        "unit_price_aed": unit,
        "qty": item.qty,
        "line_total_aed": round(unit * item.qty, 2),
        "features": svc.get("features") or [],
        "source": "mongo:service_catalog",
    }


async def _price_package(item: OrderItemIn) -> Dict[str, Any]:
    rows: List[Dict[str, Any]] = []
    if item.package_id:
        rows = await _sb_get("freezone_packages", {"id": f"eq.{item.package_id}", "select": "*"})
    if not rows and item.package_name and item.freezone:
        rows = await _sb_get("freezone_packages", {
            "freezone": f"eq.{item.freezone}",
            "package_name": f"eq.{item.package_name}",
            "select": "*", "limit": "1",
        })
    if not rows:
        raise HTTPException(400, "Unknown package — refresh the page and pick the package again")
    row = rows[0]
    if row.get("is_active") is False:
        raise HTTPException(400, "Package is no longer available")
    unit = _first_price(row, PACKAGE_PRICE_KEYS) + _money(row.get("service_fee"), 0.0)
    if unit <= 0:
        raise HTTPException(400, "Package has no valid price")
    return {
        "kind": "package",
        "ref": str(row.get("id")),
        "name": f"{row.get('freezone') or 'Free Zone'} — {row.get('package_name') or 'Business Setup Package'}",
        "billing": "one-time",
        "price_label": f"AED {unit:,.0f}",
        "unit_price_aed": unit,
        "qty": 1,
        "line_total_aed": round(unit, 2),
        "source": "supabase:freezone_packages",
    }


async def _price_addon(item: OrderItemIn) -> Dict[str, Any]:
    if not (item.addon_id or item.addon_name):
        raise HTTPException(400, "addon item requires an addon_id or addon_name")
    for table in ("service_addons", "package_addons"):
        params = ({"id": f"eq.{item.addon_id}", "select": "*"} if item.addon_id
                  else {"addon_name": f"eq.{item.addon_name}", "select": "*", "limit": "1"})
        rows = await _sb_get(table, params)
        if rows:
            row = rows[0]
            if row.get("is_active") is False:
                raise HTTPException(400, "Add-on is no longer available")
            unit = _first_price(row, ADDON_PRICE_KEYS)
            return {
                "kind": "addon",
                "ref": str(row.get("id")),
                "name": row.get("addon_name") or row.get("name") or "Add-on",
                "billing": row.get("unit") or "one-time",
                "price_label": f"AED {unit:,.0f}",
                "unit_price_aed": unit,
                "qty": item.qty,
                "line_total_aed": round(unit * item.qty, 2),
                "source": f"supabase:{table}",
            }
    raise HTTPException(400, f"Unknown add-on: {item.addon_id or item.addon_name}")


async def _coupon_discount(code: str, subtotal: float) -> Dict[str, Any]:
    rows = await _sb_get("coupons", {"code": f"eq.{code.upper()}", "select": "*"})
    if not rows or rows[0].get("is_active") is False:
        return {"code": code, "applied": False, "amount_aed": 0.0, "reason": "invalid or inactive coupon"}
    c = rows[0]
    limit = c.get("usage_limit")
    if limit is not None and _money(c.get("used_count"), 0) >= _money(limit, 0):
        return {"code": code, "applied": False, "amount_aed": 0.0, "reason": "usage limit reached"}
    value = _money(c.get("discount_value"), 0)
    amount = subtotal * value / 100.0 if c.get("discount_type") == "pct" else value
    amount = round(min(max(amount, 0.0), subtotal), 2)
    return {"code": c.get("code"), "applied": amount > 0, "amount_aed": amount,
            "discount_type": c.get("discount_type"), "discount_value": value}


# ----------------------------------------------------------------- endpoint
@router.post("")
async def create_order(payload: OrderIn):
    if not payload.items:
        raise HTTPException(400, "At least one item is required")
    if len(payload.items) > 25:
        raise HTTPException(400, "Too many items")

    line_items: List[Dict[str, Any]] = []
    for item in payload.items:
        if item.kind == "service":
            line_items.append(await _price_service(item))
        elif item.kind == "package":
            line_items.append(await _price_package(item))
        else:
            line_items.append(await _price_addon(item))

    base_price = round(sum(li["line_total_aed"] for li in line_items if li["kind"] != "addon"), 2)
    addons_total = round(sum(li["line_total_aed"] for li in line_items if li["kind"] == "addon"), 2)
    subtotal = round(base_price + addons_total, 2)

    coupon = None
    discount_total = 0.0
    if payload.coupon_code:
        coupon = await _coupon_discount(payload.coupon_code, subtotal)
        discount_total = coupon["amount_aed"]

    final_total = round(max(subtotal - discount_total, 0.0), 2)
    if final_total <= 0 or final_total > MAX_ORDER_AED:
        raise HTTPException(400, "Computed order total is invalid")

    primary = next((li for li in line_items if li["kind"] != "addon"), line_items[0])
    package_item = next((li for li in line_items if li["kind"] == "package"), None)
    is_services_only = package_item is None

    order_id = str(uuid.uuid4())
    reference = _reference()
    contact = payload.contact
    notes = " | ".join(filter(None, [
        f"Ref: {reference}",
        f"Server-priced ({len(line_items)} line items)",
        f"Activity: {payload.business.get('activity')}" if payload.business.get("activity") else None,
        f"Office: {payload.office_type}" if payload.office_type else None,
        f"Coupon: {coupon['code']} (-AED {discount_total:,.0f})" if coupon and coupon["applied"] else None,
        f"User: {payload.user_id}" if payload.user_id else None,
    ]))

    order_row = {
        "id": order_id,
        "order_ref": reference,
        "customer_name": contact.name,
        "customer_email": str(contact.email).lower(),
        "customer_phone": f"{contact.phone_code or ''} {contact.phone or ''}".strip() or None,
        "freezone": ("Accounting & Compliance" if is_services_only
                     else (payload.zone_name or payload.zone_slug or "Free Zone")),
        "package_id": package_item["ref"] if package_item else None,
        "package_name": payload.package_name or primary["name"],
        "duration_years": int(_money(payload.duration_years, 1)),
        "visa_count": int(_money(payload.visa_count, 0)),
        "shareholder_count": int(_money(payload.business.get("shareholders"), 1)),
        "base_price": base_price,
        "addons_total": addons_total,
        "discount_total": discount_total,
        "final_total": final_total,
        "currency": "AED",
        "status": "draft",
        "notes": notes or None,
    }

    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            f"{SUPABASE_URL}/rest/v1/checkout_orders",
            headers={**SVC, "Prefer": "return=minimal"},
            json=[order_row],
        )
        if r.status_code >= 400:
            logger.error("checkout_orders insert failed %s: %s", r.status_code, r.text[:600])
            raise HTTPException(502, "Could not save the order. Please try again.")

        for li in [x for x in line_items if x["kind"] == "addon"]:
            try:
                await c.post(
                    f"{SUPABASE_URL}/rest/v1/checkout_order_addons",
                    headers={**SVC, "Prefer": "return=minimal"},
                    json=[{"order_id": order_id, "addon_name": li["name"],
                           "price": li["unit_price_aed"], "currency": "AED"}],
                )
            except Exception as exc:  # non-fatal: totals already snapshotted
                logger.warning("addon row insert failed: %s", exc)

    await snapshots.insert_one({
        "_id": order_id,
        "order_ref": reference,
        "customer_email": order_row["customer_email"],
        "customer_name": contact.name,
        "line_items": line_items,
        "base_price": base_price,
        "addons_total": addons_total,
        "discount_total": discount_total,
        "final_total": final_total,
        "currency": "AED",
        "coupon": coupon,
        "business": payload.business,
        "created_at": _now(),
    })

    return {
        "id": order_id,
        "reference": reference,
        "order_ref": reference,
        **{k: v for k, v in order_row.items() if k not in ("id", "order_ref")},
        "line_items": line_items,
        "coupon": coupon,
    }


@router.get("/{order_id}")
async def get_order(order_id: str):
    doc = await snapshots.find_one({"_id": order_id})
    if not doc:
        raise HTTPException(404, "Order not found")
    out = {k: v for k, v in doc.items() if k != "_id"}
    out["id"] = order_id
    return out
