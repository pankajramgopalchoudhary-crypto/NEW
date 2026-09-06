"""Admin live-editor for Supabase `freezone_packages`.

Endpoints:
  GET    /api/admin/packages          → list every package (admin role required)
  POST   /api/admin/packages          → create a new package row
  PATCH  /api/admin/packages/{id}     → update an existing row (price, visas, etc.)
  DELETE /api/admin/packages/{id}     → mark is_active=false (soft delete)

Public site (FreeZones, Compare, AI Search, Mainland) reads from the same
table, so admin edits reflect on the website within seconds (no rebuild).
"""
from __future__ import annotations
import os
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
import httpx

logger = logging.getLogger(__name__)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

router = APIRouter(prefix="/api/admin/packages", tags=["admin-packages"])


def _hdr(prefer: Optional[str] = None) -> Dict[str, str]:
    h = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    return h


async def _assert_admin(authorization: Optional[str]) -> None:
    """Resolve the bearer token to a user, then ensure role is admin/manager."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")
    token = authorization.split(" ", 1)[1]
    async with httpx.AsyncClient(timeout=10) as cli:
        r = await cli.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {token}"},
        )
        if r.status_code != 200:
            raise HTTPException(401, "Invalid token")
        user = r.json()
        uid = user.get("id")
        if not uid:
            raise HTTPException(401, "User not found")
        # Look up role from profiles
        rp = await cli.get(
            f"{SUPABASE_URL}/rest/v1/profiles",
            params={"select": "role,email", "id": f"eq.{uid}"},
            headers=_hdr(),
        )
        rows = rp.json() if rp.status_code == 200 else []
        role = (rows[0].get("role") if rows else "client").lower()
        if role not in ("admin", "manager", "founder"):
            raise HTTPException(403, f"Admin role required (you are {role})")


# ----------  Models ----------
class PackageIn(BaseModel):
    freezone: str
    name: Optional[str] = None
    base_price: float
    currency: Optional[str] = "AED"
    visas_included: Optional[int] = 0
    activities_included: Optional[int] = 1
    office_type: Optional[str] = None
    duration_years: Optional[int] = 1
    notes: Optional[str] = None
    is_active: Optional[bool] = True


class PackagePatch(BaseModel):
    freezone: Optional[str] = None
    name: Optional[str] = None
    base_price: Optional[float] = None
    currency: Optional[str] = None
    visas_included: Optional[int] = None
    activities_included: Optional[int] = None
    office_type: Optional[str] = None
    duration_years: Optional[int] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


# ----------  Endpoints ----------
@router.get("")
async def list_packages(authorization: Optional[str] = Header(default=None)) -> List[Dict[str, Any]]:
    await _assert_admin(authorization)
    async with httpx.AsyncClient(timeout=15) as cli:
        r = await cli.get(
            f"{SUPABASE_URL}/rest/v1/freezone_packages",
            params={"select": "*", "order": "freezone.asc,base_price.asc"},
            headers=_hdr(),
        )
        if r.status_code != 200:
            raise HTTPException(r.status_code, r.text)
        return r.json()


@router.post("")
async def create_package(body: PackageIn, authorization: Optional[str] = Header(default=None)):
    await _assert_admin(authorization)
    async with httpx.AsyncClient(timeout=15) as cli:
        r = await cli.post(
            f"{SUPABASE_URL}/rest/v1/freezone_packages",
            headers=_hdr("return=representation"),
            json=body.model_dump(exclude_none=True),
        )
        if r.status_code not in (200, 201):
            raise HTTPException(r.status_code, r.text)
        rows = r.json()
        return rows[0] if isinstance(rows, list) and rows else rows


@router.patch("/{pkg_id}")
async def update_package(pkg_id: str, body: PackagePatch, authorization: Optional[str] = Header(default=None)):
    await _assert_admin(authorization)
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(400, "Nothing to update")
    async with httpx.AsyncClient(timeout=15) as cli:
        r = await cli.patch(
            f"{SUPABASE_URL}/rest/v1/freezone_packages",
            params={"id": f"eq.{pkg_id}"},
            headers=_hdr("return=representation"),
            json=payload,
        )
        if r.status_code not in (200, 204):
            raise HTTPException(r.status_code, r.text)
        rows = r.json() if r.text else []
        return rows[0] if isinstance(rows, list) and rows else {"ok": True}


@router.delete("/{pkg_id}")
async def delete_package(pkg_id: str, authorization: Optional[str] = Header(default=None)):
    """Soft delete by setting is_active=false (keeps historic orders intact)."""
    await _assert_admin(authorization)
    async with httpx.AsyncClient(timeout=15) as cli:
        r = await cli.patch(
            f"{SUPABASE_URL}/rest/v1/freezone_packages",
            params={"id": f"eq.{pkg_id}"},
            headers=_hdr("return=representation"),
            json={"is_active": False},
        )
        if r.status_code not in (200, 204):
            raise HTTPException(r.status_code, r.text)
        return {"ok": True, "id": pkg_id}
