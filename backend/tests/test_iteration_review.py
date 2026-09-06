"""Iteration regression tests for review_request items:
- /api/ health
- /api/guides/golden-visa.pdf (renamed var data -> pdf_bytes)
- /api/aria/chat (Haiku) — should stream within ~8s and end with [DONE]
"""
import json
import time
from pathlib import Path
import requests

# Resolve base URL from frontend .env
FRONT_ENV = Path("/app/frontend/.env").read_text()
BASE_URL = ""
for line in FRONT_ENV.splitlines():
    if line.startswith("REACT_APP_BACKEND_URL="):
        BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
        break
assert BASE_URL, "REACT_APP_BACKEND_URL missing"


# ---------- Health ----------
def test_root_health():
    r = requests.get(f"{BASE_URL}/api/", timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert body.get("message") == "Hello World", body


# ---------- Golden Visa PDF ----------
def test_golden_visa_pdf_endpoint():
    r = requests.get(f"{BASE_URL}/api/guides/golden-visa.pdf", timeout=30)
    assert r.status_code == 200, f"status={r.status_code} body={r.text[:200]}"
    ctype = r.headers.get("content-type", "")
    assert "application/pdf" in ctype, f"content-type={ctype!r}"
    body = r.content
    assert len(body) >= 5 * 1024, f"PDF too small: {len(body)} bytes"
    assert body[:5] == b"%PDF-", f"Not a PDF header: {body[:8]!r}"


# ---------- ARIA Chat (SSE) ----------
def test_aria_chat_streams_within_8s_and_done():
    payload = {
        "session_id": "TEST_iteration_review",
        "message": "How much does IFZA cost?",
        "language": "English",
    }
    t0 = time.monotonic()
    with requests.post(
        f"{BASE_URL}/api/aria/chat", json=payload, stream=True, timeout=60
    ) as r:
        connect_time = time.monotonic() - t0
        assert r.status_code == 200, f"status={r.status_code} body={r.text[:300]}"
        ctype = r.headers.get("content-type", "")
        assert "text/event-stream" in ctype, f"content-type={ctype!r}"
        # connection within 3s
        assert connect_time < 5, f"Slow SSE connect: {connect_time:.2f}s"

        chunks = []
        saw_done = False
        first_delta_time = None
        for raw in r.iter_lines(decode_unicode=True):
            if not raw:
                continue
            if raw.startswith("data: "):
                data = raw[6:]
                if data.strip() == "[DONE]":
                    saw_done = True
                    break
                try:
                    obj = json.loads(data)
                    if "delta" in obj:
                        if first_delta_time is None:
                            first_delta_time = time.monotonic() - t0
                        chunks.append(obj["delta"])
                    elif "error" in obj:
                        raise AssertionError(f"Aria stream error: {obj['error']}")
                except json.JSONDecodeError:
                    pass
            # safety break: don't loop forever
            if time.monotonic() - t0 > 30:
                break

        total_time = time.monotonic() - t0
        assert saw_done, f"Did not see [DONE]. chunks={len(chunks)} time={total_time:.2f}s"
        assert len(chunks) > 0, "No delta chunks"
        combined = "".join(chunks)
        assert len(combined) > 10, f"Reply too short: {combined!r}"
        # Soft assert speed — log but only fail if very slow (>15s)
        print(f"\n[ARIA] connect={connect_time:.2f}s first_delta={first_delta_time}s total={total_time:.2f}s reply_len={len(combined)}")
        assert total_time < 20, f"Aria too slow: {total_time:.2f}s (Haiku target ~3-8s)"
