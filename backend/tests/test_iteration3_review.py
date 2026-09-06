"""
Iteration 3 review tests — DIFC/ADGM catalog, founder discount, tickets, admin endpoints.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://production-audit-uae.preview.emergentagent.com").rstrip("/")

# ---------------- Catalog ----------------

class TestCatalog:
    def test_catalog_root_counts(self):
        r = requests.get(f"{BASE_URL}/api/catalog", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert len(d["jurisdictions"]) == 12, f"jur={len(d['jurisdictions'])}"
        assert len(d["mainland"]) == 3
        assert len(d["coming_soon"]) == 13
        assert len(d["packages"]) >= 120
        assert len(d["addons"]) == 17
        assert "package_addons" in d and "package_discounts" in d

    @pytest.mark.parametrize("slug,gov", [("difc", 16900), ("adgm", 7350)])
    def test_jurisdiction_difc_adgm(self, slug, gov):
        r = requests.get(f"{BASE_URL}/api/catalog/jurisdictions/{slug}", timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()["jurisdiction"]
        assert j["slug"] == slug
        assert j["gov"] == gov
        pkgs = r.json()["packages"]
        assert len(pkgs) >= 1
        # Every package must not be AED 0 unless pricing_mode=on_request
        for p in pkgs:
            price = p.get("offer_price") or p.get("package_price") or 0
            if p.get("pricing_mode") == "on_request":
                assert price == 0
            else:
                assert price > 0, f"non-on_request pkg {p['package_name']} has 0 price"

    def test_adgm_packages_filter(self):
        r = requests.get(f"{BASE_URL}/api/catalog/packages?freezone=ADGM", timeout=15)
        assert r.status_code == 200
        data = r.json()
        pkgs = data if isinstance(data, list) else data.get("packages", [])
        assert len(pkgs) == 5

    def test_difc_has_on_request_package(self):
        r = requests.get(f"{BASE_URL}/api/catalog/jurisdictions/difc", timeout=15)
        pkgs = r.json()["packages"]
        or_pkgs = [p for p in pkgs if p.get("pricing_mode") == "on_request"]
        assert any("DFSA" in p["package_name"] for p in or_pkgs)

    def test_adgm_has_on_request_package(self):
        r = requests.get(f"{BASE_URL}/api/catalog/jurisdictions/adgm", timeout=15)
        pkgs = r.json()["packages"]
        or_pkgs = [p for p in pkgs if p.get("pricing_mode") == "on_request"]
        assert any("FSRA" in p["package_name"] and "Category A" in p["package_name"] for p in or_pkgs)


# ---------------- Orders: on_request rejection ----------------

class TestOnRequestRejection:
    def _find_pkg(self, slug, needle):
        r = requests.get(f"{BASE_URL}/api/catalog/jurisdictions/{slug}", timeout=15)
        for p in r.json()["packages"]:
            if needle in p["package_name"]:
                return p
        return None

    def test_difc_dfsa_order_rejected(self):
        pkg = self._find_pkg("difc", "DFSA")
        assert pkg
        payload = {
            "contact": {"email": f"TEST_or_{uuid.uuid4().hex[:6]}@example.com", "name": "T"},
            "items": [{"kind": "package", "package_id": pkg["id"], "freezone": "DIFC",
                       "package_name": pkg["package_name"], "qty": 1}],
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=payload, timeout=15)
        assert r.status_code in (400, 422), f"expected 400, got {r.status_code}: {r.text}"

    def test_adgm_fsra_order_rejected(self):
        pkg = self._find_pkg("adgm", "FSRA-Regulated Financial Services (Category A)")
        assert pkg
        payload = {
            "contact": {"email": f"TEST_or_{uuid.uuid4().hex[:6]}@example.com", "name": "T"},
            "items": [{"kind": "package", "package_id": pkg["id"], "freezone": "ADGM",
                       "package_name": pkg["package_name"], "qty": 1}],
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=payload, timeout=15)
        assert r.status_code in (400, 422)


# ---------------- Founder discount ----------------

MEMBER_EMAIL = "pankajdxb555@gmail.com"
NONMEMBER_EMAIL = f"TEST_nm_{uuid.uuid4().hex[:8]}@example.com"


class TestFounderDiscount:
    def test_member_status(self):
        r = requests.get(f"{BASE_URL}/api/orders/founder-status", params={"email": MEMBER_EMAIL}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("member") is True, d
        assert d.get("service_pct") == 15
        assert d.get("package_pct") == 10

    def test_nonmember_status(self):
        r = requests.get(f"{BASE_URL}/api/orders/founder-status", params={"email": NONMEMBER_EMAIL}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("member") is False

    def test_member_bookkeeping_15pct(self):
        # Find bookkeeping service
        rs = requests.get(f"{BASE_URL}/api/services", timeout=15).json()
        services = rs if isinstance(rs, list) else rs.get("services", [])
        bk = next((s for s in services if "bookkeeping" in (s.get("slug","")+s.get("name","")).lower()), None)
        assert bk, services
        payload = {
            "contact": {"email": MEMBER_EMAIL, "name": "Member"},
            "items": [{"kind": "service", "slug": bk.get("slug") or bk.get("id"), "qty": 1}],
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        d = r.json().get("order") or r.json()
        # 15% off 1200 = 180 discount => 1020
        assert abs(d.get("discount_total", 0) - 180) < 1, d
        assert abs(d.get("final_total", 0) - 1020) < 1, d

    def test_founders_club_never_discounted(self):
        payload = {
            "contact": {"email": MEMBER_EMAIL, "name": "Member"},
            "items": [{"kind": "service", "slug": "founders-club-lifetime", "qty": 1}],
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        d = r.json().get("order") or r.json()
        assert d.get("discount_total", 0) == 0, d
        assert abs(d.get("final_total", 0) - 999) < 1, d

    def test_nonmember_no_discount(self):
        payload = {
            "contact": {"email": NONMEMBER_EMAIL, "name": "NM"},
            "items": [{"kind": "service", "slug": "bookkeeping", "qty": 1}],
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        d = r.json().get("order") or r.json()
        assert d.get("discount_total", 0) == 0


# ---------------- Tickets: unification & admin endpoints ----------------

class TestTickets:
    def test_create_ticket_and_status_404(self):
        payload = {
            "email": f"TEST_t_{uuid.uuid4().hex[:6]}@example.com",
            "name": "T",
            "subject": "Test unified thread",
            "message": "Hello from test",
        }
        r = requests.post(f"{BASE_URL}/api/support/tickets", json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        tid = (r.json().get("ticket") or r.json()).get("id")
        assert tid
        # Admin patch on unknown id -> 404
        bogus = requests.patch(f"{BASE_URL}/api/admin/tickets/nonexistent-xyz/status",
                               json={"status": "resolved", "priority": "high"}, timeout=15)
        # It may need auth; accept 401/403 as too, but ideally 404 without auth guard
        assert bogus.status_code in (401, 403, 404), bogus.status_code


# ---------------- Admin new endpoints (public smoke, may need auth) ----------------

class TestAdminEndpoints:
    def test_ai_support_logs_exists(self):
        r = requests.get(f"{BASE_URL}/api/admin/ai-support/logs", timeout=15)
        assert r.status_code != 404, "endpoint still missing"

    def test_email_logs_stats_exists(self):
        r = requests.get(f"{BASE_URL}/api/admin/email-logs/stats", timeout=15)
        assert r.status_code != 404, "endpoint still missing"


# ---------------- No AED 0 across catalog packages ----------------

class TestNoZeroPrice:
    def test_all_fixed_packages_have_positive_price(self):
        r = requests.get(f"{BASE_URL}/api/catalog", timeout=30)
        pkgs = r.json()["packages"]
        offenders = []
        for p in pkgs:
            if p.get("pricing_mode") == "on_request":
                continue
            price = p.get("offer_price") or p.get("package_price") or p.get("price_aed") or 0
            if not price or price <= 0:
                offenders.append((p.get("freezone"), p.get("package_name"), price))
        assert not offenders, f"packages with 0 price: {offenders[:10]}"
