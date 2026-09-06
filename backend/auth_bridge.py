"""Auth bridge — signup helper that auto-confirms email (since project has no SMTP).

POST /api/auth/signup
- Forwards signup to Supabase
- Immediately confirms the user via service-role admin API
- Returns the auth tokens so frontend can sign them in instantly
"""
from __future__ import annotations
import os
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field
import httpx

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SR = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

router = APIRouter(prefix="/api/auth", tags=["auth"])


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: Optional[str] = ""
    phone: Optional[str] = ""
    phone_country_code: Optional[str] = "+971"


@router.post("/signup")
async def signup(req: SignupRequest):
    if not (SUPABASE_URL and SUPABASE_ANON and SUPABASE_SR):
        raise HTTPException(500, "Supabase auth not configured.")
    async with httpx.AsyncClient(timeout=15) as client:
        # 1. Create user via signup endpoint
        signup_resp = await client.post(
            f"{SUPABASE_URL}/auth/v1/signup",
            headers={"apikey": SUPABASE_ANON, "Content-Type": "application/json"},
            json={
                "email": req.email,
                "password": req.password,
                "data": {
                    "full_name": req.full_name,
                    "phone": req.phone,
                    "phone_country_code": req.phone_country_code,
                },
            },
        )
        if signup_resp.status_code >= 400:
            body = signup_resp.json() if signup_resp.headers.get("content-type", "").startswith("application/json") else {"msg": signup_resp.text}
            raise HTTPException(signup_resp.status_code, body.get("msg") or body.get("error_description") or "Signup failed")
        signup_data = signup_resp.json()
        user_id = signup_data.get("id") or signup_data.get("user", {}).get("id")
        if not user_id:
            raise HTTPException(500, "Supabase signup returned no user id.")

        # 2. Auto-confirm the email (since no SMTP is configured)
        confirm_resp = await client.put(
            f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
            headers={
                "apikey": SUPABASE_SR,
                "Authorization": f"Bearer {SUPABASE_SR}",
                "Content-Type": "application/json",
            },
            json={"email_confirm": True},
        )
        if confirm_resp.status_code >= 400:
            logger.warning("Email auto-confirm failed: %s %s", confirm_resp.status_code, confirm_resp.text)
            # Continue — user can still log in if they confirm manually

        # 3. Sign in to obtain tokens
        login_resp = await client.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers={"apikey": SUPABASE_ANON, "Content-Type": "application/json"},
            json={"email": req.email, "password": req.password},
        )
        if login_resp.status_code >= 400:
            body = login_resp.json() if login_resp.headers.get("content-type", "").startswith("application/json") else {"msg": login_resp.text}
            raise HTTPException(login_resp.status_code, body.get("msg") or "Auto-login after signup failed")
        return login_resp.json()


class ResendConfirmRequest(BaseModel):
    email: EmailStr


@router.post("/admin-confirm")
async def admin_confirm(req: ResendConfirmRequest):
    """Manually confirm an existing unconfirmed user's email."""
    if not (SUPABASE_URL and SUPABASE_SR):
        raise HTTPException(500, "Supabase admin not configured.")
    async with httpx.AsyncClient(timeout=10) as client:
        # Find user by email
        list_resp = await client.get(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            params={"per_page": "200"},
            headers={"apikey": SUPABASE_SR, "Authorization": f"Bearer {SUPABASE_SR}"},
        )
        users = list_resp.json().get("users", [])
        target = next((u for u in users if (u.get("email") or "").lower() == req.email.lower()), None)
        if not target:
            raise HTTPException(404, "User not found.")
        confirm = await client.put(
            f"{SUPABASE_URL}/auth/v1/admin/users/{target['id']}",
            headers={"apikey": SUPABASE_SR, "Authorization": f"Bearer {SUPABASE_SR}", "Content-Type": "application/json"},
            json={"email_confirm": True},
        )
        if confirm.status_code >= 400:
            raise HTTPException(confirm.status_code, confirm.text)
        return {"ok": True, "user_id": target["id"], "email": target["email"]}
