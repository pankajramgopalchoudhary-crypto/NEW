"""Tests for service catalog + server-side order pricing."""
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://production-audit-uae.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CONTACT = {"name": "Test User", "email": "TEST_orders@example.com", "phone": "501234567", "phone_code": "+971"}


# ---------- Service Catalog ----------
def test_services_catalog_has_five_seeded():
    r = requests.get(f"{API}/services", timeout=30)
    assert r.status_code == 200
    svcs = {s["slug"]: s for s in r.json()["services"]}
    expected = {
        "corporate-tax-registration": (1000.0, "one-time"),
        "corporate-tax-filing": (1000.0, "per-filing"),
        "auditing": (1500.0, "monthly"),
        "bookkeeping": (1200.0, "monthly"),
        "founders-club-lifetime": (999.0, "one-time"),
    }
    for slug, (price, billing) in expected.items():
        assert slug in svcs, f"missing seeded {slug}"
        assert svcs[slug]["price_aed"] == price
        assert svcs[slug]["billing"] == billing
        assert svcs[slug]["is_active"] is True


def test_service_by_slug_and_404():
    r = requests.get(f"{API}/services/corporate-tax-registration", timeout=30)
    assert r.status_code == 200
    assert r.json()["slug"] == "corporate-tax-registration"
    r = requests.get(f"{API}/services/definitely-not-a-service-xyz", timeout=30)
    assert r.status_code == 404


def _post_order(payload):
    return requests.post(f"{API}/orders", json=payload, timeout=30)


def test_order_ignores_forged_price_single_service():
    payload = {
        "items": [{"kind": "service", "slug": "corporate-tax-registration", "qty": 1, "price_aed": 1.0, "line_total_aed": 1.0}],
        "final_total": 1.0,
        "contact": CONTACT,
    }
    r = _post_order(payload)
    assert r.status_code in (200, 201), r.text
    body = r.json()
    assert float(body["final_total"]) == 1000.0
    assert body["id"]


def test_order_multi_service_totals_2200():
    payload = {
        "items": [
            {"kind": "service", "slug": "corporate-tax-registration", "qty": 1},
            {"kind": "service", "slug": "bookkeeping", "qty": 1},
        ],
        "contact": CONTACT,
    }
    r = _post_order(payload)
    assert r.status_code in (200, 201), r.text
    assert float(r.json()["final_total"]) == 2200.0


def test_order_founders_club_999():
    payload = {"items": [{"kind": "service", "slug": "founders-club-lifetime", "qty": 1}], "contact": CONTACT}
    r = _post_order(payload)
    assert r.status_code in (200, 201), r.text
    assert float(r.json()["final_total"]) == 999.0


def test_order_unknown_slug_returns_400():
    r = _post_order({"items": [{"kind": "service", "slug": "nope-not-real", "qty": 1}], "contact": CONTACT})
    assert r.status_code == 400, r.text


def test_order_empty_items_returns_400():
    r = _post_order({"items": [], "contact": CONTACT})
    # FastAPI/Pydantic can validate as 422 for missing list vs runtime 400; accept both but prefer 400
    assert r.status_code in (400, 422), r.text


def test_order_unknown_package_returns_400():
    r = _post_order({"items": [{"kind": "package", "package_id": "no-such-pkg-xyz", "qty": 1}], "contact": CONTACT})
    assert r.status_code == 400, r.text


def test_order_invalid_coupon_ignored():
    r = _post_order({
        "items": [{"kind": "service", "slug": "corporate-tax-registration", "qty": 1}],
        "coupon_code": "TOTALLY_NOT_A_COUPON_XYZ",
        "contact": CONTACT,
    })
    assert r.status_code in (200, 201), r.text
    body = r.json()
    assert float(body["final_total"]) == 1000.0
    assert float(body.get("discount_total") or 0) == 0.0


def test_order_get_snapshot():
    payload = {"items": [{"kind": "service", "slug": "auditing", "qty": 1}], "contact": CONTACT}
    r = _post_order(payload)
    assert r.status_code in (200, 201), r.text
    order_id = r.json()["id"]
    g = requests.get(f"{API}/orders/{order_id}", timeout=30)
    assert g.status_code == 200, g.text
    gbody = g.json()
    assert len(gbody.get("line_items", [])) >= 1
    assert float(gbody["final_total"]) == 1500.0
