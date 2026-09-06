"""Canonical standalone service catalog (Mongo `service_catalog`).

Single source of truth for prices of standalone, purchasable services
(accounting/tax/compliance + Founder Club membership). Read-only over the
public API; all writes happen from the admin app (Next.js) against the same
collection, so prices are editable from one place only.
"""
from __future__ import annotations

import os
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/services", tags=["services"])

_mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
_db = _mongo[os.environ["DB_NAME"]]
catalog = _db["service_catalog"]

DEFAULT_SERVICES: List[Dict[str, Any]] = [
    {
        "slug": "corporate-tax-registration",
        "name": "Corporate Tax Registration",
        "category": "tax",
        "price_aed": 1000.0,
        "billing": "one-time",
        "price_label": "AED 1,000 one-time",
        "description": "End-to-end UAE Corporate Tax registration with the Federal Tax Authority, including EmaraTax account setup and TRN issuance.",
        "features": [
            "FTA EmaraTax account creation",
            "Corporate Tax registration filing",
            "Tax Registration Number (TRN) issuance",
            "Document checklist + review by a UAE tax advisor",
        ],
        "sort_order": 10,
    },
    {
        "slug": "corporate-tax-filing",
        "name": "Corporate Tax Filing",
        "category": "tax",
        "price_aed": 1000.0,
        "billing": "per-filing",
        "price_label": "AED 1,000 starting / per filing",
        "description": "Preparation and submission of your annual UAE Corporate Tax return, with taxable-income computation and small business relief review.",
        "features": [
            "Taxable income computation",
            "Annual CT return preparation and submission",
            "Small Business Relief / exemption assessment",
            "Filing confirmation and audit-ready working papers",
        ],
        "sort_order": 20,
    },
    {
        "slug": "auditing",
        "name": "Auditing",
        "category": "audit",
        "price_aed": 1500.0,
        "billing": "monthly",
        "price_label": "AED 1,500/month starting",
        "description": "Ongoing audit support by UAE-approved auditors — statutory audit readiness, financial statements and authority submission.",
        "features": [
            "Approved-auditor statutory audit",
            "IFRS financial statements",
            "Freezone / authority submission support",
            "Year-round auditor liaison",
        ],
        "sort_order": 30,
    },
    {
        "slug": "bookkeeping",
        "name": "Bookkeeping",
        "category": "accounting",
        "price_aed": 1200.0,
        "billing": "monthly",
        "price_label": "AED 1,200/month starting",
        "description": "Monthly bookkeeping kept FTA-compliant — transaction recording, reconciliations and management reports.",
        "features": [
            "Monthly transaction recording",
            "Bank and ledger reconciliation",
            "Monthly P&L and balance sheet",
            "VAT-ready, FTA-compliant records",
        ],
        "sort_order": 40,
    },
    {
        "slug": "founders-club-lifetime",
        "name": "Founder Club Membership — Lifetime",
        "category": "membership",
        "price_aed": 999.0,
        "billing": "one-time",
        "price_label": "AED 999 one-time",
        "description": "One-time lifetime Founder Club membership — lifetime renewal discounts, a dedicated advisor and founder-only pricing across every SmartSetupUAE service.",
        "features": [
            "Lifetime licence renewal discount",
            "AED 0 advisory / setup service fee (first 500 founders)",
            "Dedicated advisor on WhatsApp",
            "Founder pricing on tax, audit and bookkeeping",
            "Priority support queue and partner perks",
        ],
        "sort_order": 50,
    },
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def public_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    out = {k: v for k, v in doc.items() if k != "_id"}
    out["id"] = str(doc.get("_id"))
    return out


async def ensure_defaults() -> None:
    """Idempotent seed — never overwrites prices an admin has edited."""
    for svc in DEFAULT_SERVICES:
        await catalog.update_one(
            {"slug": svc["slug"]},
            {
                "$setOnInsert": {
                    "_id": str(uuid.uuid4()),
                    **svc,
                    "currency": "AED",
                    "is_active": True,
                    "created_at": _now(),
                    "updated_at": _now(),
                }
            },
            upsert=True,
        )
    await catalog.create_index("slug", unique=True)


async def get_service(slug: str) -> Optional[Dict[str, Any]]:
    return await catalog.find_one({"slug": slug, "is_active": True})


@router.get("")
async def list_services(category: Optional[str] = None):
    q: Dict[str, Any] = {"is_active": True}
    if category:
        q["category"] = category
    rows = [
        public_doc(d)
        async for d in catalog.find(q).sort("sort_order", 1)
    ]
    return {"services": rows}


@router.get("/{slug}")
async def one_service(slug: str):
    doc = await get_service(slug)
    if not doc:
        raise HTTPException(404, "Service not found")
    return public_doc(doc)
