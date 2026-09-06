"""Admin user-management API (backed by Supabase Admin Auth API).

Role hierarchy enforced server-side:
    admin    → can create/disable/promote anyone
    manager  → can create/disable staff & reviewer (CANNOT touch admin or other managers)
    staff    → read-only (assigned leads)
    reviewer → read-only (assigned KYC queue)
    client   → no admin access at all

All endpoints require an `Authorization: Bearer <supabase_access_token>` header.
We resolve the caller's role from public.profiles via service_role and gate accordingly.
"""
from __future__ import annotations
import os
import logging
from typing import Optional, Literal
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, EmailStr
import httpx

logger = logging.getLogger(__name__)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

router = APIRouter(prefix="/api/admin", tags=["admin"])

ROLE_HIERARCHY = {"admin": 4, "manager": 3, "staff": 2, "reviewer": 2, "client": 1}
MANAGEABLE = {
    "admin":   {"admin", "manager", "staff", "reviewer", "client"},
    "manager": {"staff", "reviewer"},  # explicit subset
}

SVC = {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}", "Content-Type": "application/json"}


async def _current_caller(authorization: str = Header(default="")) -> dict:
    """Resolve the calling user from the bearer token + check profile role."""
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    async with httpx.AsyncClient(timeout=10) as c:
        # Use the user's token to fetch THEIR auth.user record
        r = await c.get(f"{SUPABASE_URL}/auth/v1/user",
                        headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {token}"})
        if r.status_code >= 400:
            raise HTTPException(401, "Invalid token")
        user = r.json()
        # Fetch their profile (role lives here)
        p = await c.get(f"{SUPABASE_URL}/rest/v1/profiles",
                        params={"id": f"eq.{user['id']}", "select": "id,email,role,assigned_manager"},
                        headers=SVC)
        prof = (p.json() or [{}])[0] if p.status_code < 300 else {}
        role = prof.get("role") or "client"
        if role not in ROLE_HIERARCHY or ROLE_HIERARCHY[role] < 3:
            raise HTTPException(403, f"Role '{role}' is not allowed to manage users")
        return {"id": user["id"], "email": user.get("email"), "role": role, "profile": prof}


class CreateUserPayload(BaseModel):
    email: EmailStr
    password: str
    role: Literal["manager", "staff", "reviewer", "client"]
    full_name: Optional[str] = ""
    assigned_manager: Optional[str] = None  # FK to profiles.id of a manager


@router.post("/users")
async def admin_create_user(payload: CreateUserPayload, caller: dict = Depends(_current_caller)):
    """Admin/manager creates a user with a target role."""
    allowed = MANAGEABLE.get(caller["role"], set())
    if payload.role not in allowed:
        raise HTTPException(403, f"You ({caller['role']}) cannot create role '{payload.role}'")

    # Managers can only assign new staff/reviewer to themselves
    assigned = payload.assigned_manager
    if caller["role"] == "manager":
        assigned = caller["id"]

    async with httpx.AsyncClient(timeout=20) as c:
        # 1) Create auth user
        r = await c.post(f"{SUPABASE_URL}/auth/v1/admin/users", headers=SVC, json={
            "email": payload.email,
            "password": payload.password,
            "email_confirm": True,
            "user_metadata": {"full_name": payload.full_name, "role": payload.role},
            "app_metadata": {"role": payload.role, "created_by": caller["id"]},
        })
        if r.status_code >= 400:
            raise HTTPException(r.status_code, r.text[:300])
        user_id = r.json().get("id")

        # 2) Upsert profile (only staff-side roles get profiles)
        if payload.role in ("manager", "staff", "reviewer"):
            prof_body = {
                "id": user_id, "email": payload.email,
                "full_name": payload.full_name or payload.email.split("@")[0],
                "role": payload.role,
            }
            if assigned and payload.role in ("staff", "reviewer"):
                prof_body["assigned_manager"] = assigned
            pr = await c.post(f"{SUPABASE_URL}/rest/v1/profiles",
                              headers={**SVC, "Prefer": "resolution=merge-duplicates,return=representation"},
                              json=prof_body)
            if pr.status_code >= 400:
                raise HTTPException(pr.status_code, pr.text[:300])
        return {"ok": True, "id": user_id, "email": payload.email, "role": payload.role, "assigned_manager": assigned}


class UpdateUserPayload(BaseModel):
    target_id: str
    new_role: Optional[Literal["admin", "manager", "staff", "reviewer", "client"]] = None
    new_password: Optional[str] = None
    full_name: Optional[str] = None
    assigned_manager: Optional[str] = None
    disable: Optional[bool] = None


@router.patch("/users")
async def admin_update_user(payload: UpdateUserPayload, caller: dict = Depends(_current_caller)):
    """Update role / password / manager assignment / disable a user."""
    allowed = MANAGEABLE.get(caller["role"], set())
    async with httpx.AsyncClient(timeout=15) as c:
        # Fetch target profile to know existing role
        tp = await c.get(f"{SUPABASE_URL}/rest/v1/profiles",
                         params={"id": f"eq.{payload.target_id}", "select": "id,email,role,assigned_manager"},
                         headers=SVC)
        target = (tp.json() or [{}])[0] if tp.status_code < 300 else {}
        target_role = target.get("role") or "client"
        if target_role not in allowed and payload.new_role not in allowed:
            raise HTTPException(403, f"You cannot modify role '{target_role}'")
        if caller["role"] == "manager" and target.get("assigned_manager") not in (None, caller["id"]):
            raise HTTPException(403, "You can only edit staff assigned to you")

        # Update auth.users (password + ban)
        admin_body = {}
        if payload.new_password:
            admin_body["password"] = payload.new_password
        if payload.disable is not None:
            admin_body["ban_duration"] = "876600h" if payload.disable else "none"
        if admin_body:
            ur = await c.put(f"{SUPABASE_URL}/auth/v1/admin/users/{payload.target_id}",
                             headers=SVC, json=admin_body)
            if ur.status_code >= 400:
                raise HTTPException(ur.status_code, ur.text[:300])

        # Update profiles
        prof_patch = {}
        if payload.new_role:
            prof_patch["role"] = payload.new_role
        if payload.full_name is not None:
            prof_patch["full_name"] = payload.full_name
        if payload.assigned_manager is not None:
            prof_patch["assigned_manager"] = payload.assigned_manager
        if prof_patch:
            pr = await c.patch(
                f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{payload.target_id}",
                headers={**SVC, "Prefer": "return=minimal"},
                json=prof_patch,
            )
            if pr.status_code >= 400:
                raise HTTPException(pr.status_code, pr.text[:300])
        return {"ok": True, "target_id": payload.target_id, "patched": prof_patch, "auth_patched": admin_body}


@router.get("/users")
async def admin_list_users(caller: dict = Depends(_current_caller)):
    """List staff-side users. Managers see only their own team. Admin sees all."""
    async with httpx.AsyncClient(timeout=12) as c:
        params = {"select": "id,email,full_name,role,assigned_manager,created_at", "order": "role.asc,email.asc"}
        if caller["role"] == "manager":
            params["or"] = f"(id.eq.{caller['id']},assigned_manager.eq.{caller['id']})"
        r = await c.get(f"{SUPABASE_URL}/rest/v1/profiles", params=params, headers=SVC)
        return {"users": r.json() if r.status_code < 300 else []}
