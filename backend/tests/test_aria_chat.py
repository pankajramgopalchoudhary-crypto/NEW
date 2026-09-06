"""Smoke test for Aria SSE chat endpoint."""
import json
from pathlib import Path
import requests

FRONT_ENV = Path("/app/frontend/.env").read_text()
for line in FRONT_ENV.splitlines():
    if line.startswith("REACT_APP_BACKEND_URL="):
        BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
        break


def test_aria_chat_streams_and_ends():
    """POST /api/aria/chat should return a text/event-stream that ends with [DONE]."""
    payload = {
        "session_id": "TEST_pytest_session",
        "message": "Hi, what is the cheapest UAE free zone?",
        "language": "English",
    }
    with requests.post(
        f"{BASE_URL}/api/aria/chat", json=payload, stream=True, timeout=60
    ) as r:
        assert r.status_code == 200, f"chat status={r.status_code} body={r.text[:300]}"
        assert "text/event-stream" in r.headers.get("content-type", "")

        chunks = []
        saw_done = False
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
                        chunks.append(obj["delta"])
                    elif "error" in obj:
                        # API key missing or upstream blew up
                        raise AssertionError(f"Aria stream error: {obj['error']}")
                except json.JSONDecodeError:
                    pass

        assert saw_done, "Stream did not end with [DONE] sentinel"
        assert len(chunks) > 0, "No delta chunks received from Aria"
        combined = "".join(chunks)
        assert len(combined) > 5, f"Aria reply too short: {combined!r}"
