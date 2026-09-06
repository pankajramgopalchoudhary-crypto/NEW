"""Regression: internal agent notes must never reach a customer.

`GET /api/support/tickets/{id}` used to return every message in the thread,
including `from_role: "internal"` notes written by staff. This test drives
`one_ticket` directly with stubbed Mongo collections so it runs offline.
"""
import asyncio
import importlib
import sys
import types

import pytest


def _make_cursor(rows):
    class _Cursor:
        def sort(self, *_a, **_kw):
            return self

        def limit(self, *_a, **_kw):
            return self

        def __aiter__(self):
            async def gen():
                for r in rows:
                    yield dict(r)
            return gen()

    return _Cursor()


class _Tickets:
    def __init__(self, doc):
        self._doc = doc

    async def find_one(self, *_a, **_kw):
        return dict(self._doc)


class _Messages:
    def __init__(self, rows):
        self._rows = rows

    def find(self, *_a, **_kw):
        return _make_cursor(self._rows)


TICKET = {"_id": "t1", "customer_email": "client@example.com", "subject": "Help", "status": "open"}
MESSAGES = [
    {"ticket_id": "t1", "from_role": "customer", "body": "I need help"},
    {"ticket_id": "t1", "from_role": "internal", "body": "SECRET internal note: upsell this lead"},
    {"ticket_id": "t1", "from_role": "agent", "body": "Happy to help"},
]


@pytest.fixture()
def support(monkeypatch):
    mod = importlib.import_module("support")
    monkeypatch.setattr(mod, "_tickets", _Tickets(TICKET))
    monkeypatch.setattr(mod, "_messages", _Messages(MESSAGES))
    return mod


def _run(coro):
    return asyncio.get_event_loop_policy().new_event_loop().run_until_complete(coro)


def test_customer_never_sees_internal_notes(support, monkeypatch):
    async def fake_role(_auth):
        return {"id": "u1", "email": "client@example.com", "role": "client"}

    monkeypatch.setattr(support, "_resolve_caller_role", fake_role)
    out = _run(support.one_ticket("t1", authorization="Bearer x"))
    roles = [m["from_role"] for m in out["messages"]]
    assert "internal" not in roles
    assert roles == ["customer", "agent"]
    assert "SECRET internal note" not in str(out)


def test_staff_still_sees_internal_notes(support, monkeypatch):
    async def fake_role(_auth):
        return {"id": "a1", "email": "agent@smartsetupuae.ae", "role": "admin"}

    monkeypatch.setattr(support, "_resolve_caller_role", fake_role)
    out = _run(support.one_ticket("t1", authorization="Bearer y"))
    roles = [m["from_role"] for m in out["messages"]]
    assert "internal" in roles
    assert len(roles) == 3
