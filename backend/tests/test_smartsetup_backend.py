"""Comprehensive backend tests for SmartSetupUAE — OCR, payments, lifecycle, admin extras."""
import os
import base64
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load backend env to get Supabase keys
load_dotenv(Path("/app/backend/.env"))

# Read public URL from frontend .env
FRONT_ENV = Path("/app/frontend/.env").read_text()
for line in FRONT_ENV.splitlines():
    if line.startswith("REACT_APP_BACKEND_URL="):
        BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
        break

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_ANON = os.environ["SUPABASE_ANON_KEY"]

ADMIN_EMAIL = "admin@smartsetupuae.ae"
ADMIN_PASS = os.environ.get("FOUNDER_PASSWORD", "")
CLIENT_EMAIL = "client@smartsetupuae.ae"
CLIENT_PASS = "Client@0555"


def _sign_in(email: str, password: str) -> str:
    r = requests.post(
        f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
        headers={"apikey": SUPABASE_ANON, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=20,
    )
    assert r.status_code == 200, f"Supabase signin failed for {email}: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_token():
    return _sign_in(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="session")
def client_token():
    return _sign_in(CLIENT_EMAIL, CLIENT_PASS)


# ========== HEALTH ==========
class TestHealth:
    def test_root(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=10)
        assert r.status_code == 200
        assert r.json().get("message") == "Hello World"


# ========== OCR ==========
class TestOCR:
    def test_types(self):
        r = requests.get(f"{BASE_URL}/api/ocr/types", timeout=10)
        assert r.status_code == 200
        body = r.json()
        types = body["types"]
        keys = {t["key"] for t in types}
        expected = {"passport", "emirates_id", "visa", "utility_bill", "trade_license", "moa", "tenancy_contract"}
        assert expected.issubset(keys), f"Missing types: {expected - keys}"
        for t in types:
            assert isinstance(t.get("fields"), list) and len(t["fields"]) > 0

    def test_parse_invalid_empty_image(self):
        r = requests.post(f"{BASE_URL}/api/ocr/parse",
                          json={"doc_type": "passport", "image_base64": "", "mime_type": "image/jpeg"},
                          timeout=20)
        assert r.status_code == 400

    def test_parse_invalid_doctype(self):
        # build a >200 char base64 string
        big = base64.b64encode(b"x" * 300).decode()
        r = requests.post(f"{BASE_URL}/api/ocr/parse",
                          json={"doc_type": "xyz", "image_base64": big, "mime_type": "image/jpeg"},
                          timeout=20)
        assert r.status_code == 400

    def test_parse_invalid_mime(self):
        big = base64.b64encode(b"x" * 300).decode()
        r = requests.post(f"{BASE_URL}/api/ocr/parse",
                          json={"doc_type": "passport", "image_base64": big, "mime_type": "image/svg+xml"},
                          timeout=20)
        assert r.status_code == 400

    def test_parse_real_image_shape(self):
        # Tiny but valid JPEG (100x100 gray pixel art via PIL fallback) — use a publicly available small image
        # Build a minimal valid JPEG using raw bytes: a 1x1 white JPEG
        # Use a known small jpeg base64 (8x8 placeholder)
        jpeg_b64 = (
            "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a"
            "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy"
            "MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAgDASIA"
            "AhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQA"
            "AAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3"
            "ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWm"
            "p6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMB"
            "AAIRAxEAPwD3+iiigD//2Q=="
        )
        r = requests.post(f"{BASE_URL}/api/ocr/parse",
                          json={"doc_type": "passport", "image_base64": jpeg_b64, "mime_type": "image/jpeg"},
                          timeout=60)
        assert r.status_code == 200, f"OCR call failed: {r.status_code} {r.text[:400]}"
        body = r.json()
        assert "ok" in body and "doc_type" in body and "confidence" in body and "fields" in body
        assert body["doc_type"] == "passport"
        assert isinstance(body["confidence"], (int, float))
        assert isinstance(body["fields"], dict)


# ========== PAYMENTS ==========
class TestPayments:
    def test_currencies(self):
        r = requests.get(f"{BASE_URL}/api/payments/currencies", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["base"] == "AED"
        currs = {c["code"]: c for c in body["currencies"]}
        for code in ["AED", "USD", "EUR", "GBP", "INR"]:
            assert code in currs, f"Missing currency {code}"
            c = currs[code]
            assert "label" in c and "symbol" in c and "rate_from_aed" in c
            assert isinstance(c["rate_from_aed"], (int, float)) and c["rate_from_aed"] > 0
        assert currs["AED"]["rate_from_aed"] == 1.0

    def test_create_checkout_session(self):
        r = requests.post(f"{BASE_URL}/api/payments/checkout/session",
                          json={
                              "amount_aed": 999,
                              "currency": "AED",
                              "customer_email": "test@example.com",
                              "origin_url": "https://example.com",
                          }, timeout=30)
        assert r.status_code == 200, f"checkout failed: {r.status_code} {r.text[:300]}"
        body = r.json()
        for k in ["url", "session_id", "display_amount", "display_currency"]:
            assert k in body, f"missing {k}"
        assert body["display_currency"] == "AED"
        assert body["url"].startswith("http")


# ========== LIFECYCLE ==========
class TestLifecycle:
    def test_steps_definition(self):
        r = requests.get(f"{BASE_URL}/api/lifecycle/progress/steps", timeout=10)
        assert r.status_code == 200
        steps = r.json()["steps"]
        assert len(steps) == 17

    def test_progress_no_auth(self):
        r = requests.get(f"{BASE_URL}/api/lifecycle/progress", params={"order_ref": "test"}, timeout=10)
        assert r.status_code == 401

    def test_progress_with_client(self, client_token):
        h = {"Authorization": f"Bearer {client_token}"}
        r = requests.get(f"{BASE_URL}/api/lifecycle/progress", params={"order_ref": "TEST123"},
                         headers=h, timeout=15)
        assert r.status_code == 200, f"progress: {r.status_code} {r.text[:200]}"
        body = r.json()
        assert body["order_ref"] == "TEST123"
        assert body["steps"]["lead_created"]["status"] == "completed"

    def test_appointments(self, client_token):
        r = requests.get(f"{BASE_URL}/api/lifecycle/appointments",
                         headers={"Authorization": f"Bearer {client_token}"}, timeout=15)
        assert r.status_code == 200
        assert "appointments" in r.json()

    def test_profile(self, client_token):
        r = requests.get(f"{BASE_URL}/api/lifecycle/profile",
                         headers={"Authorization": f"Bearer {client_token}"}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "email" in body
        assert "history" in body

    def test_vault(self, client_token):
        r = requests.get(f"{BASE_URL}/api/lifecycle/vault",
                         headers={"Authorization": f"Bearer {client_token}"}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "folders" in body and "total" in body

    def test_compliance(self, client_token):
        r = requests.get(f"{BASE_URL}/api/lifecycle/compliance",
                         headers={"Authorization": f"Bearer {client_token}"}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "vat_status" in body

    def test_renewals(self, client_token):
        r = requests.get(f"{BASE_URL}/api/lifecycle/renewals",
                         headers={"Authorization": f"Bearer {client_token}"}, timeout=15)
        assert r.status_code == 200
        assert "renewals" in r.json()

    def test_golden_visa_lead_valid(self):
        r = requests.post(f"{BASE_URL}/api/lifecycle/golden-visa/lead",
                          json={
                              "name": "Test Lead",
                              "phone": "+971500000000",
                              "nationality": "India",
                              "current_country": "UAE",
                              "category": "investor",
                              "email": "gv_test@example.com",
                          }, timeout=20)
        assert r.status_code == 200, f"GV: {r.status_code} {r.text[:200]}"
        body = r.json()
        assert "id" in body and "created_at" in body

    def test_golden_visa_lead_missing_fields(self):
        r = requests.post(f"{BASE_URL}/api/lifecycle/golden-visa/lead",
                          json={"name": "OnlyName"}, timeout=10)
        assert r.status_code == 422


# ========== ADMIN ==========
class TestAdmin:
    def test_stats_no_token(self):
        r = requests.get(f"{BASE_URL}/api/admin/dashboard/stats", timeout=10)
        assert r.status_code == 401

    def test_stats_client_forbidden(self, client_token):
        r = requests.get(f"{BASE_URL}/api/admin/dashboard/stats",
                         headers={"Authorization": f"Bearer {client_token}"}, timeout=15)
        assert r.status_code == 403

    def test_stats_admin_ok(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/dashboard/stats",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        body = r.json()
        for k in ["leads", "orders", "founder_club", "freezone_packages",
                  "activities", "golden_visa_leads", "appointments"]:
            assert k in body, f"missing {k}"

    def test_admin_users(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/users",
                         headers={"Authorization": f"Bearer {admin_token}"}, timeout=15)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        body = r.json()
        assert "users" in body
        assert len(body["users"]) >= 5

    def test_seed_then_cleanup(self, admin_token):
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.post(f"{BASE_URL}/api/admin/seed/dummy", headers=h, timeout=120)
        assert r.status_code == 200, f"seed: {r.status_code} {r.text[:300]}"
        body = r.json()
        assert body["ok"] is True
        assert body["leads_inserted"] >= 40, f"leads_inserted={body['leads_inserted']}"
        assert body["completed_companies"] == 10
        assert body["appointments"] == 5

        # Stats should reflect leads now
        r2 = requests.get(f"{BASE_URL}/api/admin/dashboard/stats", headers=h, timeout=20)
        assert r2.status_code == 200
        assert r2.json()["leads"]["total"] >= 40

        # Cleanup
        r3 = requests.delete(f"{BASE_URL}/api/admin/seed/cleanup", headers=h, timeout=60)
        assert r3.status_code == 200
        assert r3.json()["ok"] is True
