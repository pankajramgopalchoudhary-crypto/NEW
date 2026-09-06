# Test Plan

Existing: `backend/tests/*.py` (pytest, 5 files: aria chat, notify triggers, support AI auto-reply, smartsetup backend, iteration review), `test_reports/iteration_1.json`.

## Per-phase gates
| Phase | Test | Tool |
|---|---|---|
| 3 | Backend boots with all env; frontend build has no `undefined` API base; admin build | curl `/api/`, `yarn build` |
| 5 | Preflight from allowed origin → 200 with ACAO; from `https://evil.example` → no ACAO | curl `-H Origin` |
| 6 | Admin login/logout/expired token/role gating | curl + Playwright |
| 7,11,12 | Register → verify → login; wrong/expired OTP; duplicate email; reset password; old token reuse fails | curl + Playwright |
| 8-10 | Send test email → `email_logs` entry with provider id → webhook `delivered` updates status; duplicate webhook ignored | curl |
| 14-20 | Create order server-side → snapshot → pay (Stripe test) → order `paid` → customer & admin see same → historical price unchanged after package edit | curl + Playwright |
| 21-26 | Pricing audit table all MATCH; 4 accounting services exist with required prices; standalone checkout | curl |
| 27-29 | `smart-rank` returns exactly 3, unique, active, priced; each has checkout URL | curl |
| 31-33 | Customer cannot see internal notes; ticket IDs unique under 50 concurrent creates | pytest |
| 34-35 | `/api/sla/tick` idempotent; breached/at-risk transitions; unauthorized tick rejected | pytest/curl |
| 36-37 | AI suggestion SUGGEST_ONLY; high-risk text → requires_human; low confidence → escalation | pytest |
| 38-41 | Admin KPIs equal DB counts; customer 360; audit entries created | curl |
| 44-45 | Full customer + admin E2E | testing agent (Playwright) |
| 46 | `yarn build` (frontend, admin), `python -m compileall`, pytest | shell |
| 47 | IDOR: customer A GET customer B ticket/order → 403 | curl |
