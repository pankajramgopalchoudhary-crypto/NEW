"""Shared authentication helpers for backend route modules."""
from __future__ import annotations

import os
from typing import Dict, Optional

import httpx

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


async def resolve_caller_role(authorization: Optional[str]) -> Dict[str, str]:
    """Return the authenticated user's identity and role, or an anonymous user."""
    if not authorization or not authorization.startswith("Bearer "):
        return {"id": "", "email": "", "role": "anon"}
    token = authorization.split(" ", 1)[1]
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            user_response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {token}"},
            )
            if user_response.status_code != 200:
                return {"id": "", "email": "", "role": "anon"}
            user = user_response.json() or {}
            user_id, email = user.get("id", ""), user.get("email", "")
            profile_response = await client.get(
                f"{SUPABASE_URL}/rest/v1/profiles",
                params={"select": "role", "id": f"eq.{user_id}"},
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                },
            )
            rows = profile_response.json() if profile_response.status_code == 200 else []
            role = (rows[0].get("role") if rows else "client").lower()
            return {"id": user_id, "email": email, "role": role}
    except Exception:
        return {"id": "", "email": "", "role": "anon"}


def is_staff(role: str) -> bool:
    return role in ("admin", "manager", "staff", "reviewer", "founder")