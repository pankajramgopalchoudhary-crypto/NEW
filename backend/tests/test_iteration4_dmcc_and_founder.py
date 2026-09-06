"""Iteration 4 review — DMCC pricing bug fix + member pricing consistency.

Bug: DMCC used to show 'FROM AED 1,925' (AstroLabs partner listing) and also had a
zero-price 'Uptown Homeowners Package' plus 2/3-year terms. Only 1-Year DMCC packages
should be visible, ranging Nook AED 10,345 → Jump Start AED 43,780.
"""
import os
import uuid
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://production-audit-uae.preview.emergentagent.com"
).rstrip("/")


# ---------------- DMCC package data quality ----------------

class TestDmccDataQuality:
    def _dmcc(self):
        r = requests.get(f"{BASE_URL}/api/catalog/packages?freezone=DMCC", timeout=15)
        assert r.status_code == 200
        data = r.json()
        return data if isinstance(data, list) else data.get("packages", [])

    def test_dmcc_exactly_12_active_1_year(self):
        pkgs = self._dmcc()
        active = [p for p in pkgs if p.get("is_active")]
        assert len(active) == 12, f"expected 12 active DMCC packages, got {len(active)}"
        for p in active:
            assert p.get("duration") == "1 Year", (
                f"non 1-Year DMCC package leaked through: {p.get('package_name')}={p.get('duration')}"
            )

    def test_dmcc_no_astrolabs_or_uptown(self):
        pkgs = self._dmcc()
        for p in pkgs:
            name = str(p.get("package_name", ""))
            assert "AstroLabs" not in name and "Astrolabs" not in name
            assert "Uptown" not in name

    def test_dmcc_cheapest_is_nook_10345(self):
        active = [p for p in self._dmcc() if p.get("is_active")]
        prices = [(p.get("offer_price") or p.get("package_price"), p.get("package_name")) for p in active]
        prices.sort(key=lambda x: x[0])
        assert prices[0][1] == "Nook Package", f"cheapest is {prices[0]}"
        assert float(prices[0][0]) == 10345

    def test_dmcc_highest_is_jump_start_43780(self):
        active = [p for p in self._dmcc() if p.get("is_active")]
        # Use base package_price (not offer) for the top-of-range check per spec
        prices = [(p.get("package_price"), p.get("package_name")) for p in active]
        prices.sort(key=lambda x: float(x[0]), reverse=True)
        assert prices[0][1] == "Jump Start Package", f"top is {prices[0]}"
        assert float(prices[0][0]) == 43780

    def test_dmcc_no_zero_or_1925(self):
        for p in self._dmcc():
            price = p.get("package_price") or 0
            assert float(price) != 1925, f"AstroLabs 1925 still present: {p.get('package_name')}"
            if p.get("is_active"):
                assert float(p.get("offer_price") or price) > 0, f"zero-price active pkg {p.get('package_name')}"


# ---------------- Regression: total counts + other zones untouched ----------------

class TestCatalogCountsRegression:
    def test_total_active_packages_118(self):
        r = requests.get(f"{BASE_URL}/api/catalog/packages", timeout=15)
        pkgs = r.json()
        pkgs = pkgs if isinstance(pkgs, list) else pkgs.get("packages", [])
        active = [p for p in pkgs if p.get("is_active")]
        assert len(active) == 118, f"total active pkgs={len(active)}"

    def test_zone_counts_unchanged(self):
        r = requests.get(f"{BASE_URL}/api/catalog/packages", timeout=15)
        pkgs = r.json()
        pkgs = pkgs if isinstance(pkgs, list) else pkgs.get("packages", [])
        active = [p for p in pkgs if p.get("is_active")]
        counts = {}
        for p in active:
            counts[p.get("freezone")] = counts.get(p.get("freezone"), 0) + 1
        # Per iteration_3 report + expected DMCC=12
        expected = {"DMCC": 12, "IFZA": 8, "ANCFZ": 29, "SHAMS": 28, "DIFC": 4, "ADGM": 5}
        for zone, n in expected.items():
            assert counts.get(zone) == n, f"{zone} expected {n}, got {counts.get(zone)}"


# ---------------- Founder Club status + discount math ----------------

class TestFounderPricingMath:
    def test_member_true_for_pankaj(self):
        r = requests.get(
            f"{BASE_URL}/api/orders/founder-status",
            params={"email": "pankajdxb555@gmail.com"},
            timeout=15,
        )
        assert r.status_code == 200
        j = r.json()
        assert j["member"] is True
        assert float(j["service_pct"]) == 15.0
        assert float(j["package_pct"]) == 10.0

    def test_non_member_fresh_test_email(self):
        email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.get(f"{BASE_URL}/api/orders/founder-status", params={"email": email}, timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert j["member"] is False
        assert float(j["service_pct"]) == 0
        assert float(j["package_pct"]) == 0

    def test_member_bookkeeping_15pct(self):
        payload = {
            "contact": {
                "email": "pankajdxb555@gmail.com",
                "name": "TEST Bookkeeping Member",
                "phone": "501234567",
                "phone_code": "+971",
            },
            "items": [{"kind": "service", "slug": "bookkeeping", "qty": 1}],
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        o = r.json()
        # Accept common response shapes
        total = float(o.get("final_total") or o.get("total") or o.get("amount") or 0)
        # bookkeeping AED 1200 → 15% off → 1020
        assert abs(total - 1020) < 0.5, f"expected 1020, got {total}: {o}"

    def test_member_dmcc_nook_10pct(self):
        # Fetch nook id
        r = requests.get(f"{BASE_URL}/api/catalog/packages?freezone=DMCC", timeout=15)
        pkgs = r.json()
        pkgs = pkgs if isinstance(pkgs, list) else pkgs.get("packages", [])
        nook = next(p for p in pkgs if p.get("package_name") == "Nook Package")
        payload = {
            "contact": {
                "email": "pankajdxb555@gmail.com",
                "name": "TEST DMCC Nook Member",
                "phone": "501234567",
                "phone_code": "+971",
            },
            "items": [{"kind": "package", "package_id": nook["id"], "qty": 1}],
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        o = r.json()
        total = float(o.get("final_total") or o.get("total") or o.get("amount") or 0)
        # Nook 10,345 → 10% off → 9,310.50
        assert abs(total - 9310.5) < 0.5, f"expected 9310.5, got {total}: {o}"

    def test_founders_club_lifetime_never_discounted(self):
        payload = {
            "contact": {
                "email": "pankajdxb555@gmail.com",
                "name": "TEST FC Lifetime",
                "phone": "501234567",
                "phone_code": "+971",
            },
            "items": [{"kind": "service", "slug": "founders-club-lifetime", "qty": 1}],
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        o = r.json()
        total = float(o.get("final_total") or o.get("total") or o.get("amount") or 0)
        assert abs(total - 999) < 0.5, f"membership must not be discounted, got {total}"


# ---------------- DIFC/ADGM regression ----------------

class TestDifcAdgmRegression:
    def test_difc_from_16900(self):
        r = requests.get(f"{BASE_URL}/api/catalog/packages?freezone=DIFC", timeout=15)
        pkgs = r.json()
        pkgs = pkgs if isinstance(pkgs, list) else pkgs.get("packages", [])
        active_fixed = [p for p in pkgs if p.get("is_active") and p.get("pricing_mode") != "on_request"]
        min_price = min(float(p.get("offer_price") or p.get("package_price")) for p in active_fixed)
        assert min_price == 16900

    def test_adgm_from_7350(self):
        r = requests.get(f"{BASE_URL}/api/catalog/packages?freezone=ADGM", timeout=15)
        pkgs = r.json()
        pkgs = pkgs if isinstance(pkgs, list) else pkgs.get("packages", [])
        active_fixed = [p for p in pkgs if p.get("is_active") and p.get("pricing_mode") != "on_request"]
        min_price = min(float(p.get("offer_price") or p.get("package_price")) for p in active_fixed)
        assert min_price == 7350

    def test_dfsa_on_request_order_rejected(self):
        r = requests.get(f"{BASE_URL}/api/catalog/jurisdictions/difc", timeout=15)
        pkgs = r.json()["packages"]
        or_pkg = next(p for p in pkgs if p.get("pricing_mode") == "on_request" and "DFSA" in p["package_name"])
        payload = {
            "contact": {
                "email": f"TEST_{uuid.uuid4().hex[:6]}@example.com",
                "name": "TEST DFSA",
                "phone": "501234567",
                "phone_code": "+971",
            },
            "items": [{"kind": "package", "package_id": or_pkg["id"], "qty": 1}],
        }
        r = requests.post(f"{BASE_URL}/api/orders", json=payload, timeout=20)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
