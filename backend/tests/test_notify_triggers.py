"""Tests for SmartSetupUAE notification trigger endpoints (PART 19).

Covers:
- GET /api/notify-triggers/status
- POST /api/notify-triggers/lead-submitted (public)
- POST /api/notify-triggers/{order-placed, doc-approved, doc-rejected,
  appointment-scheduled, renewal-reminder, founder-club-purchased}
  with auth gating (401 / 403 / 200)
- Regression endpoints (/api/, ocr/types, payments/currencies,
  lifecycle/progress/steps, guides/golden-visa.pdf)
- /api/lifecycle/golden-visa/lead (auto-fires notify_lead_submitted)
"""
import os
from pathlib import Path
import pytest
import requests

_front_env = Path("/app/frontend/.env").read_text()
BASE = ""
for _line in _front_env.splitlines():
    if _line.startswith("REACT_APP_BACKEND_URL="):
        BASE = _line.split("=", 1)[1].strip().rstrip("/")
        break
BASE = BASE or os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
SUPABASE_URL = "https://smrsaedmuaizlesehpee.supabase.co"
ANON = os.environ.get("REACT_APP_SUPABASE_ANON_KEY", "")

ADMIN_EMAIL = "admin@smartsetupuae.ae"
ADMIN_PASS = os.environ.get("FOUNDER_PASSWORD", "")
CLIENT_EMAIL = "client@smartsetupuae.ae"
CLIENT_PASS = "Client@0555"
TEST_EMAIL = "pankajdxb555@gmail.com"


def _login(email: str, password: str) -> str:
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": ANON, "Content-Type": "application/json"},
        json={"email": email, "password": password}, timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"Login failed for {email}: {r.status_code} {r.text[:200]}")
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="session")
def client_token():
    return _login(CLIENT_EMAIL, CLIENT_PASS)


def _h(tok): return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _assert_email_ok(data: dict):
    """email.ok must be True; whatsapp may be ok=false (Meta perms)."""
    assert isinstance(data, dict), f"Not a dict: {data}"
    assert "email" in data, f"No email in {data}"
    assert data["email"].get("ok") is True, f"Email send not ok: {data['email']}"
    # whatsapp present but may be ok=False — must not crash
    if "whatsapp" in data:
        assert "ok" in data["whatsapp"]


# ============================== STATUS ==============================
class TestStatus:
    def test_status_shape(self):
        r = requests.get(f"{BASE}/api/notify-triggers/status", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["resend_configured"] is True
        assert d["whatsapp_configured"] is True
        assert d["whatsapp_phone_id"] == "1203743809484415"
        assert d["admin_email"] == TEST_EMAIL
        assert d["admin_whatsapp"]


# ============================ LEAD SUBMITTED (public) ============================
class TestLeadSubmitted:
    def test_lead_submitted_public_no_auth(self):
        r = requests.post(
            f"{BASE}/api/notify-triggers/lead-submitted",
            json={
                "lead_name": "TEST_QA Bot", "lead_phone": "971500000000",
                "lead_email": TEST_EMAIL, "source": "qa_test", "summary": "auto",
            }, timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["event"] == "lead_submitted"
        _assert_email_ok(d)


# ============================ AUTH GATING ============================
class TestAuthGating:
    def test_order_placed_no_auth_returns_401(self):
        r = requests.post(f"{BASE}/api/notify-triggers/order-placed", json={
            "client_email": TEST_EMAIL, "amount": 1, "currency": "AED",
        }, timeout=15)
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"

    def test_order_placed_client_returns_403(self, client_token):
        r = requests.post(f"{BASE}/api/notify-triggers/order-placed",
                          headers=_h(client_token), json={
                              "client_email": TEST_EMAIL, "amount": 1, "currency": "AED",
                          }, timeout=15)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"


# ============================ ADMIN TRIGGERS (200, email.ok=true) ============================
class TestAdminTriggers:
    def test_order_placed_admin(self, admin_token):
        r = requests.post(f"{BASE}/api/notify-triggers/order-placed",
                          headers=_h(admin_token), json={
                              "client_email": TEST_EMAIL, "client_name": "Sara",
                              "client_whatsapp": "971500000000",
                              "order_ref": "TEST-NOTI-001", "amount": 4888,
                              "currency": "AED", "package_name": "IFZA Starter",
                              "paid": True,
                          }, timeout=30)
        assert r.status_code == 200, r.text
        _assert_email_ok(r.json())

    def test_doc_approved_admin(self, admin_token):
        r = requests.post(f"{BASE}/api/notify-triggers/doc-approved",
                          headers=_h(admin_token), json={
                              "client_email": TEST_EMAIL, "doc_label": "Passport",
                          }, timeout=30)
        assert r.status_code == 200, r.text
        _assert_email_ok(r.json())

    def test_doc_rejected_admin(self, admin_token):
        r = requests.post(f"{BASE}/api/notify-triggers/doc-rejected",
                          headers=_h(admin_token), json={
                              "client_email": TEST_EMAIL, "doc_label": "Passport",
                              "reason": "Blurry photo",
                          }, timeout=30)
        assert r.status_code == 200, r.text
        _assert_email_ok(r.json())

    def test_appointment_scheduled_admin(self, admin_token):
        r = requests.post(f"{BASE}/api/notify-triggers/appointment-scheduled",
                          headers=_h(admin_token), json={
                              "client_email": TEST_EMAIL,
                              "appointment_type": "Medical Test",
                              "date_iso": "2026-07-01T10:00:00+04:00",
                              "location": "Vision Medical",
                              "address": "Sheikh Zayed Road, Dubai",
                              "map_url": "https://maps.google.com",
                          }, timeout=30)
        assert r.status_code == 200, r.text
        _assert_email_ok(r.json())

    def test_renewal_reminder_admin(self, admin_token):
        r = requests.post(f"{BASE}/api/notify-triggers/renewal-reminder",
                          headers=_h(admin_token), json={
                              "client_email": TEST_EMAIL,
                              "renewal_type": "license",
                              "due_date": "2026-09-01", "days_remaining": 30,
                          }, timeout=30)
        assert r.status_code == 200, r.text
        _assert_email_ok(r.json())

    def test_founder_club_admin(self, admin_token):
        r = requests.post(f"{BASE}/api/notify-triggers/founder-club-purchased",
                          headers=_h(admin_token), json={
                              "client_email": TEST_EMAIL, "client_name": "Sara",
                              "expiry_date": "2027-06-25",
                          }, timeout=30)
        assert r.status_code == 200, r.text
        _assert_email_ok(r.json())


# ============================ REGRESSION ============================
class TestRegression:
    def test_root(self):
        r = requests.get(f"{BASE}/api/", timeout=10)
        assert r.status_code == 200

    def test_ocr_types(self):
        r = requests.get(f"{BASE}/api/ocr/types", timeout=10)
        assert r.status_code == 200
        d = r.json()
        items = d if isinstance(d, list) else d.get("types") or d.get("items") or list(d.values())[0]
        assert len(items) == 7, f"Expected 7 OCR types, got {len(items)}"

    def test_payments_currencies(self):
        r = requests.get(f"{BASE}/api/payments/currencies", timeout=10)
        assert r.status_code == 200
        d = r.json()
        items = d if isinstance(d, list) else d.get("currencies") or list(d.values())[0]
        assert len(items) == 5, f"Expected 5 currencies, got {len(items)}"

    def test_lifecycle_steps(self):
        r = requests.get(f"{BASE}/api/lifecycle/progress/steps", timeout=10)
        assert r.status_code == 200
        d = r.json()
        items = d if isinstance(d, list) else d.get("steps") or list(d.values())[0]
        assert len(items) == 17, f"Expected 17 lifecycle steps, got {len(items)}"

    def test_golden_visa_pdf(self):
        r = requests.get(f"{BASE}/api/guides/golden-visa.pdf", timeout=20)
        assert r.status_code == 200
        assert len(r.content) > 5000, f"PDF too small: {len(r.content)} bytes"


# ============================ AUTO-FIRE: Golden Visa lead ============================
class TestAutoFire:
    def test_golden_visa_lead_returns_200(self):
        r = requests.post(f"{BASE}/api/lifecycle/golden-visa/lead", json={
            "name": "TEST_QA Auto",
            "full_name": "TEST_QA Auto",
            "email": TEST_EMAIL,
            "phone": "971500000000",
            "whatsapp": "971500000000",
            "nationality": "Indian",
            "current_country": "UAE",
            "category": "investor",
            "notes": "qa autotest",
        }, timeout=30)
        assert r.status_code == 200, f"{r.status_code}: {r.text}"
        d = r.json()
        # Should return a lead doc / ack — must not 500
        assert isinstance(d, dict)
