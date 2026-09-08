"""Canonical jurisdiction / package / add-on catalog (Mongo).

Replaces the price constants that used to live in the React bundle
(`data/zones.js`, `data/freezonePackages.js`) and the partially-populated
Supabase `freezone_packages` table. Everything is seeded once from
`backend/seed_data/*.json`, plus a one-time import of any existing Supabase
rows, after which Mongo is the single source of truth and admin edits win.

Collections
  jurisdiction_catalog  free zones + mainland DEDs + coming-soon entries
  package_catalog       purchasable setup packages
  addon_catalog         global add-ons (visas, office, tax, ...)
  package_addon_catalog freezone-specific add-ons
  package_discount_catalog multi-year discount rules
"""
from __future__ import annotations

import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/catalog", tags=["catalog"])

SEED_DIR = Path(__file__).parent / "seed_data"
_mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
_db = _mongo[os.environ["DB_NAME"]]

jurisdictions = _db["jurisdiction_catalog"]
packages = _db["package_catalog"]
addons = _db["addon_catalog"]
package_addons = _db["package_addon_catalog"]
package_discounts = _db["package_discount_catalog"]

PRICE_KEYS = ["offer_price", "package_price", "display_price", "promotion_price",
              "discount_price", "base_price", "original_price", "price"]

# ---- Data-quality rules (applied on every startup, idempotent) --------------
# Multi-year packages are valid product data when the free zone actually sells
# them. Suppressing them here causes the catalog and the customer pricing tabs to
# hide legitimate 2/3/4/5-year offers. Keep the list empty so the app shows the
# actual package durations available for each free zone or mainland jurisdiction.
PACKAGE_EXCLUSIONS = []
DURATION_ALLOWLIST = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slugify(value: Any) -> str:
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", str(value or "").lower().replace("&", "and")))


def _num(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _truthy(value: Any, fallback: bool = True) -> bool:
    if value in (True, "true", "True", 1, "1"):
        return True
    if value in (False, "false", "False", 0, "0"):
        return False
    return fallback


def _load(name: str) -> List[Dict[str, Any]]:
    path = SEED_DIR / f"{name}.json"
    if not path.exists():
        return []
    return json.loads(path.read_text())


def package_price(doc: Dict[str, Any]) -> float:
    for key in PRICE_KEYS:
        price = _num(doc.get(key))
        if price > 0:
            return price
    return 0.0


def _package_key(doc: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "freezone": doc.get("freezone"),
        "package_name": doc.get("package_name"),
        "duration": doc.get("duration") or f"{int(_num(doc.get('duration_years'), 1))} Year",
    }


def strip(doc: Dict[str, Any]) -> Dict[str, Any]:
    out = {k: v for k, v in doc.items() if k != "_id"}
    out["id"] = str(doc.get("_id"))
    return out


# ------------------------------------------------------------------ seeding
async def _seed_collection(coll, rows: List[Dict[str, Any]], key_fn, extra: Optional[Dict] = None) -> int:
    inserted = 0
    for row in rows:
        key = key_fn(row)
        if await coll.find_one(key):
            continue
        doc = {
            "_id": str(uuid.uuid4()),
            **(extra or {}),
            **row,
            "is_active": _truthy(row.get("is_active")),
            "created_at": _now(),
            "updated_at": _now(),
        }
        # A package with no price is a quote-on-request package, never AED 0.
        if "package_price" in doc and package_price(doc) <= 0:
            doc["pricing_mode"] = "on_request"
        await coll.insert_one(doc)
        inserted += 1
    return inserted


async def _import_supabase_packages() -> int:
    """One-time import of legacy Supabase `freezone_packages` rows."""
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not (url and key):
        return 0
    try:
        async with httpx.AsyncClient(timeout=25) as c:
            r = await c.get(f"{url}/rest/v1/freezone_packages",
                            params={"select": "*", "limit": "1000"},
                            headers={"apikey": key, "Authorization": f"Bearer {key}"})
        rows = r.json() if r.status_code == 200 else []
    except Exception as exc:
        logger.warning("[catalog] Supabase package import skipped: %s", exc)
        return 0

    imported = 0
    for row in rows or []:
        doc = {
            "freezone": row.get("freezone"),
            "category": row.get("package_type") or "Core UAE",
            "package_name": row.get("package_name"),
            "duration": f"{int(_num(row.get('duration_years'), 1))} Year",
            "duration_years": int(_num(row.get("duration_years"), 1)),
            "workspace": "",
            "original_price": row.get("base_price") or "",
            "package_price": package_price(row),
            "offer_price": package_price(row),
            "currency": row.get("currency") or "AED",
            "includes_visa": row.get("visa_count") or 0,
            "visa_count": int(_num(row.get("visa_count"), 0)),
            "shareholder_count": int(_num(row.get("shareholder_count"), 1)),
            "activities_allowed": int(_num(row.get("activities_allowed"), 3)),
            "notes": row.get("notes") or "",
            "source": "supabase_import",
            "supabase_id": row.get("id"),
            "pricing_mode": "fixed",
            "is_active": _truthy(row.get("is_active")),
        }
        if not doc["freezone"] or not doc["package_name"] or doc["package_price"] <= 0:
            continue
        if await packages.find_one(_package_key(doc)):
            continue
        await packages.insert_one({"_id": str(uuid.uuid4()), **doc,
                                   "created_at": _now(), "updated_at": _now()})
        imported += 1
    return imported


async def _apply_data_quality() -> Dict[str, int]:
    """Idempotent clean-up so imported rows can't distort displayed prices."""
    stats = {"excluded": 0, "duration_hidden": 0, "on_request": 0}

    for rule in PACKAGE_EXCLUSIONS:
        res = await packages.update_many(
            {**rule, "is_active": True},
            {"$set": {"is_active": False, "excluded_reason": "not a licence package",
                      "updated_at": _now()}},
        )
        stats["excluded"] += res.modified_count

    for freezone, allowed in DURATION_ALLOWLIST.items():
        res = await packages.update_many(
            {"freezone": freezone, "duration": {"$nin": list(allowed)}, "is_active": True},
            {"$set": {"is_active": False, "excluded_reason": "term not sold",
                      "updated_at": _now()}},
        )
        stats["duration_hidden"] += res.modified_count

    # A package with no price is quoted on request — it must never render AED 0.
    res = await packages.update_many(
        {"$or": [{"package_price": {"$lte": 0}}, {"package_price": None}],
         "pricing_mode": {"$ne": "on_request"}},
        {"$set": {"pricing_mode": "on_request", "updated_at": _now()}},
    )
    stats["on_request"] += res.modified_count
    return stats


async def ensure_defaults() -> None:
    counts = {
        "jurisdictions": await _seed_collection(
            jurisdictions, _load("jurisdictions"), lambda r: {"slug": r["slug"]},
            {"kind": "freezone", "status": "ACTIVE"}),
        "mainland": await _seed_collection(
            jurisdictions, _load("mainland"), lambda r: {"slug": r["slug"]},
            {"kind": "mainland", "status": "ACTIVE"}),
        "coming_soon": await _seed_collection(
            jurisdictions, _load("coming_soon"),
            lambda r: {"slug": _slugify(r.get("name"))},
            {"kind": "coming_soon"}),
        "addons": await _seed_collection(addons, _load("addons"), lambda r: {"id": r["id"]}),
        "packages": await _seed_collection(packages, _load("packages"), _package_key,
                                           {"pricing_mode": "fixed"}),
        "package_addons": await _seed_collection(
            package_addons, _load("package_addons"),
            lambda r: {"freezone": r.get("freezone"), "addon_name": r.get("addon_name")}),
        "package_discounts": await _seed_collection(
            package_discounts, _load("package_discounts"),
            lambda r: {"freezone": r.get("freezone"), "package_name": r.get("package_name"),
                       "duration": r.get("duration")}),
        "supabase_import": await _import_supabase_packages(),
    }
    # coming-soon rows carry no slug in the seed file — backfill one
    async for doc in jurisdictions.find({"slug": {"$in": [None, ""]}}):
        await jurisdictions.update_one({"_id": doc["_id"]},
                                       {"$set": {"slug": _slugify(doc.get("name"))}})
    await jurisdictions.create_index("slug")
    await packages.create_index([("freezone", 1), ("package_name", 1)])
    counts["data_quality"] = await _apply_data_quality()
    logger.info("[catalog] seeded %s", {k: v for k, v in counts.items() if v})


# ------------------------------------------------------------------ helpers
async def find_package(package_id: str) -> Optional[Dict[str, Any]]:
    return await packages.find_one({"$or": [{"_id": package_id}, {"supabase_id": package_id}]})


async def find_package_by_name(freezone: str, package_name: str) -> Optional[Dict[str, Any]]:
    return await packages.find_one({"freezone": freezone, "package_name": package_name})


async def find_addon(addon_id: str, addon_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
    query: List[Dict[str, Any]] = [{"_id": addon_id}, {"id": addon_id}]
    if addon_name:
        query += [{"addon_name": addon_name}, {"label": addon_name}]
    doc = await addons.find_one({"$or": query})
    return doc or await package_addons.find_one({"$or": query})


# ------------------------------------------------------------------ routes
@router.get("")
async def whole_catalog():
    async def rows(coll, query=None, sort=None):
        cursor = coll.find(query or {"is_active": True})
        if sort:
            cursor = cursor.sort(*sort)
        return [strip(d) async for d in cursor]

    all_jur = await rows(jurisdictions)
    return {
        "jurisdictions": [j for j in all_jur if j.get("kind") == "freezone"],
        "mainland": [j for j in all_jur if j.get("kind") == "mainland"],
        "coming_soon": [j for j in all_jur if j.get("kind") == "coming_soon"],
        "packages": await rows(packages),
        "addons": await rows(addons),
        "package_addons": await rows(package_addons),
        "package_discounts": await rows(package_discounts),
        "updated_at": _now(),
    }


@router.get("/jurisdictions")
async def list_jurisdictions(kind: Optional[str] = None):
    query: Dict[str, Any] = {"is_active": True}
    if kind:
        query["kind"] = kind
    return {"jurisdictions": [strip(d) async for d in jurisdictions.find(query)]}


@router.get("/packages")
async def list_packages(freezone: Optional[str] = None):
    query: Dict[str, Any] = {"is_active": True}
    if freezone:
        query["freezone"] = freezone
    return {"packages": [strip(d) async for d in packages.find(query)]}


@router.get("/addons")
async def list_addons():
    return {
        "addons": [strip(d) async for d in addons.find({"is_active": True})],
        "package_addons": [strip(d) async for d in package_addons.find({"is_active": True})],
    }


@router.get("/jurisdictions/{slug}")
async def one_jurisdiction(slug: str):
    doc = await jurisdictions.find_one({"slug": slug, "is_active": True})
    if not doc:
        raise HTTPException(404, "Jurisdiction not found")
    pkgs = [strip(p) async for p in packages.find({"freezone": doc.get("name"), "is_active": True})]
    return {"jurisdiction": strip(doc), "packages": pkgs}
