"""Canonical standalone service catalog stored in MongoDB."""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient

router = APIRouter(prefix="/api/services", tags=["services"])
_mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
_db = _mongo[os.environ["DB_NAME"]]
catalog = _db["service_catalog"]

DEFAULT_SERVICES: List[Dict[str, Any]] = [
    {
        "slug": "corporate-tax-registration", "name": "Corporate Tax Registration", "category": "tax",
        "price_aed": 1000.0, "billing": "one-time", "price_label": "AED 1,000 one-time",
        "description": "End-to-end UAE Corporate Tax registration with the Federal Tax Authority, including EmaraTax account setup and TRN issuance.",
        "features": ["FTA EmaraTax account creation", "Corporate Tax registration filing", "Tax Registration Number (TRN) issuance", "Document checklist + review by a UAE tax advisor"], "sort_order": 10,
    },
    {
        "slug": "corporate-tax-filing", "name": "Corporate Tax Filing", "category": "tax",
        "price_aed": 1000.0, "billing": "annual", "price_label": "AED 1,000 / annual return",
        "description": "Preparation and submission of your annual UAE Corporate Tax return, with taxable-income computation and small business relief review.",
        "features": ["Taxable income computation", "Annual CT return preparation and submission", "Small Business Relief / exemption assessment", "Filing confirmation and audit-ready working papers"], "sort_order": 20,
    },
    {
        "slug": "auditing", "name": "Auditing", "category": "audit", "price_aed": 18000.0,
        "billing": "annual", "price_label": "From AED 1,500/month · billed annually", "monthly_equivalent": 1500.0, "annual_only": True,
        "pricing_options": [
            {"id": "up-to-5m", "label": "Turnover up to AED 5 million", "monthly": 1500.0, "annual": 18000.0},
            {"id": "6-to-10m", "label": "AED 6–10 million turnover", "monthly": 1666.67, "annual": 20000.04},
            {"id": "11-to-20m", "label": "AED 11–20 million turnover", "monthly": 2083.33, "annual": 24999.96},
            {"id": "21-to-30m", "label": "AED 21–30 million turnover", "monthly": 2500.0, "annual": 30000.0},
            {"id": "31-to-40m", "label": "AED 31–40 million turnover", "monthly": 2916.67, "annual": 35000.04},
            {"id": "41-to-50m", "label": "AED 41–50 million turnover", "monthly": 3333.33, "annual": 39999.96},
            {"id": "above-50m", "label": "Above AED 50 million", "on_request": True},
        ],
        "description": "Annual audit engagement by turnover band. Above AED 50 million is quoted case by case.",
        "features": ["Approved-auditor statutory audit", "IFRS financial statements", "Freezone / authority submission support", "Year-round auditor liaison"], "sort_order": 30,
    },
    {
        "slug": "bookkeeping", "name": "Bookkeeping", "category": "accounting", "price_aed": 14400.0,
        "billing": "annual", "price_label": "AED 1,200/month · AED 14,400 billed annually", "monthly_equivalent": 1200.0, "annual_only": True,
        "description": "Yearly bookkeeping engagement — transaction recording, reconciliations and management reports.",
        "features": ["Monthly transaction recording", "Bank and ledger reconciliation", "Monthly P&L and balance sheet", "VAT-ready, FTA-compliant records"], "sort_order": 40,
    },
    {
        "slug": "vat-filing", "name": "VAT Filing", "category": "tax", "price_aed": 1500.0,
        "billing": "annual", "price_label": "AED 125/month · AED 1,500 billed annually", "monthly_equivalent": 125.0, "annual_only": True,
        "description": "Annual VAT compliance support with return preparation and filing coordination.",
        "features": ["VAT return preparation", "Input and output VAT review", "FTA-ready records check", "Filing deadline reminders"], "sort_order": 45,
    },
    {
        "slug": "founders-club-lifetime", "name": "Founder Club Membership — Lifetime", "category": "membership",
        "price_aed": 999.0, "billing": "one-time", "price_label": "AED 999 one-time",
        "description": "One-time lifetime Founder Club membership — lifetime renewal discounts, a dedicated advisor and founder-only pricing across every SmartSetupUAE service.",
        "features": ["Lifetime licence renewal discount", "AED 0 advisory / setup service fee (first 500 founders)", "Dedicated advisor on WhatsApp", "Founder pricing on tax, audit and bookkeeping", "Priority support queue and partner perks"], "sort_order": 50,
    },
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def public_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    out = {k: v for k, v in doc.items() if k != "_id"}
    out["id"] = str(doc.get("_id"))
    return out


async def ensure_defaults() -> None:
    for svc in DEFAULT_SERVICES:
        await catalog.update_one(
            {"slug": svc["slug"]},
            {"$setOnInsert": {"_id": str(uuid.uuid4()), **svc, "currency": "AED", "is_active": True, "created_at": _now(), "updated_at": _now()}},
            upsert=True,
        )
        if svc["slug"] in {"auditing", "bookkeeping", "corporate-tax-filing"}:
            await catalog.update_one(
                {"slug": svc["slug"], "price_aed": {"$in": [1200.0, 1500.0, 1000.0]}, "billing": {"$in": ["monthly", "per-filing"]}},
                {"$set": {k: v for k, v in svc.items() if k not in {"slug", "sort_order"}}},
            )
    await catalog.create_index("slug", unique=True)


async def get_service(slug: str) -> Optional[Dict[str, Any]]:
    return await catalog.find_one({"slug": slug, "is_active": True})


@router.get("")
async def list_services(category: Optional[str] = None):
    q: Dict[str, Any] = {"is_active": True}
    if category:
        q["category"] = category
    rows = [public_doc(d) async for d in catalog.find(q).sort("sort_order", 1)]
    return {"services": rows}


@router.get("/{slug}")
async def one_service(slug: str):
    doc = await get_service(slug)
    if not doc:
        raise HTTPException(404, "Service not found")
    return public_doc(doc)
