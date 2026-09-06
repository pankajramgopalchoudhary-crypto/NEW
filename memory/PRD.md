# SmartSetupUAE — Product Requirements & Status

## Original problem statement
Audit and production-harden the existing SmartSetupUAE platform (repo: `pankajramchoudhary-byte/NEW-PROJECT`).
Do **not** rebuild. Platform surfaces:

| Surface | Stack | Path | Production domain |
|---|---|---|---|
| Customer site | React (CRA/CRACO) | `/app/frontend` | `smartsetupuae.ae` |
| Admin console | Next.js 14 (app router) | `/app/admin` | `admin.smartsetupuae.ae` |
| API | FastAPI + Motor | `/app/backend` | `api.smartsetupuae.ae` |

Data: **MongoDB** (backend/admin operational data) + **Supabase** (auth, packages, checkout orders).
Integrations: Resend (email + webhook status), Stripe (payments), Gemini AI support in `SUGGEST_ONLY` mode.

### Hard acceptance gates
- Recommendations must return **exactly three** valid, active, non-duplicate recommendations with canonical prices.
- Required published starting prices:
  - Corporate Tax Registration — **AED 1,000 one-time**
  - Corporate Tax Filing — **AED 1,000 starting / per filing**
  - Auditing — **AED 1,500/month starting**
  - Bookkeeping — **AED 1,200/month starting**
  - Founder Club membership — **AED 999 one-time**, purchasable standalone
- No mock/demo data. Single canonical price source. No secrets in source.

---

## Implemented

### 2026-06 — Phase 0 + 1: architecture audit
`/app/docs/`: `PRODUCTION_AUDIT.md`, `ARCHITECTURE.md`, `ENVIRONMENT.md`, `PRICING_AUDIT.md`,
`API_MAP.md`, `TEST_PLAN.md`, `DEPLOYMENT.md`. 97 backend routes mapped; risks logged.

### 2026-06 — Phase 2: security, server-side orders, service catalog, Founder Club
1. **Internal-note leak fixed** — `support.py::one_ticket` now drops `from_role == "internal"`
   messages for non-staff callers. Proven by `/app/backend/tests/test_internal_notes.py`
   (customer sees `[customer, agent]`; staff sees all 3). Passing.
2. **Server-side orders** — new `POST /api/orders` (`/app/backend/orders.py`). The browser sends
   only *identifiers*; the server re-prices from Mongo `service_catalog`, Supabase
   `freezone_packages`, `service_addons`/`package_addons` and `coupons`, then writes
   `checkout_orders` with the service-role key and snapshots immutable line items into Mongo
   `order_snapshots`. `GET /api/orders/{id}` returns the snapshot. Direct Supabase inserts were
   removed from `frontend/src/lib/checkoutSupabase.js`. Forged `price_aed` in the request body is
   ignored (verified: forged 1 → charged 1000).
3. **Canonical service catalog** — Mongo `service_catalog` seeded idempotently
   (`services_catalog.py::ensure_defaults`, `$setOnInsert` so admin edits survive restarts).
   Public read-only `GET /api/services`, `GET /api/services/{slug}`.
   Admin CRUD at `/admin/services` (founder write, manager read) via the Next.js API against the
   same collection — one price source for site + checkout + admin.
4. **New customer page `/accounting`** — the four accounting/tax services purchasable standalone
   (single or multi-select bundle), prices/labels rendered live from the catalog. Linked from the
   navbar under Corporate Services.
5. **Founder Club AED 999 standalone** — `FounderClub.jsx` no longer sends a client-side amount;
   it creates a server-priced order then opens Stripe against that `order_ref`.
6. **Post-payment fulfilment** (`backend/fulfillment.py`, called from `payments.py` on `paid`,
   idempotent via Mongo `order_fulfilments`): ensures a Supabase client-portal account (temp
   password when new), records `founder_club_memberships`, and sends the Resend Founder Club
   welcome email listing every benefit + the service confirmation email. Both verified delivered.
7. **Bugs found and fixed while testing**
   - `email_logs` wrote `provider_message_id: null`, and a unique *sparse* index only skips
     *missing* fields → the second queued email always crashed with a duplicate-key error. The
     field is now omitted until send succeeds, and a legacy non-sparse index is dropped/rebuilt.
   - Admin `/api/admin/email-logs` queried `type`/`timestamp`, but the backend writes
     `event_type`/`created_at` → Email Health always showed an empty list. Fixed, plus
     `from_alias` and free-text `q` filters and an `items` key.
   - Missing admin endpoints implemented: `/api/admin/email-logs/stats`,
     `/api/admin/ai-support/logs`.
   - `payments.py` hardcoded Stripe fallback `sk_test_emergent` removed → env-only.
   - Customers must **never** get a `profiles` row: `app_role` is a staff-only enum
     (`admin|manager|staff|reviewer`), so a row would escalate them. Client metadata goes to Mongo
     `client_profiles_ext` instead.

**Test results** — `/app/test_reports/iteration_2.json`: backend 12/12 pytest, frontend 100%
(all 21 admin pages, all 4 admin roles, `/accounting`, Founder Club purchase → Stripe AED 999).

---

## Environment notes / blockers
- **Mongo Atlas unusable**: `smartsetupuae.ovxfmoi.mongodb.net` does not resolve (cluster paused,
  renamed or deleted). Preview runs on local Mongo; the URI is parked as `MONGO_URL_ATLAS` in
  `/app/backend/.env`. **User action required.**
- **Resend domain unverified**: `smartsetupuae.ae` is not verified, so Resend only delivers to
  `pankajdxb555@gmail.com`. `RESEND_FORCE_FROM=onboarding@resend.dev` keeps sends working.
  **User action required**: verify the domain, then remove `RESEND_FORCE_FROM`.
- **Secrets were pasted in chat** — the Supabase service-role key, Resend key, admin JWT secret
  and Atlas password should all be rotated.
- Admin dev server runs on port **3001** in this pod (3000 is the customer site).
- `@supabase/supabase-js` pinned to `2.108.2` — 2.110+ requires Node ≥22, pod has Node 20.

---

## Backlog

### P0
- Resolve the Atlas cluster host and cut over from local Mongo.
- Verify `smartsetupuae.ae` in Resend; drop `RESEND_FORCE_FROM`; re-verify webhook status flow
  (`webhooks_resend.py`) idempotency end-to-end.
- Unify ticket storage: admin Mongo `tickets` vs backend `support_tickets`/`support_messages`.
- Remove the remaining hardcoded prices in `frontend/src/data/freezonePackages.js` (81),
  `data/zones.js` (26), `mock.js` (6), `Checkout.jsx` (2), `CostCalculator.jsx` (2) and read
  everything from the canonical sources.

### P1
- Centralise all Resend sends through one function (currently duplicated across
  `admin_security.py`, `careers.py`, `email_logs.py`, `notifications.py`, `admin/lib/email.js`,
  `admin/lib/emailService.js`, `admin/lib/support/supportEmail.js`).
- SLA cron (`/api/sla/tick`, `SLA_CRON_KEY`) wired and proven on Hostinger.
- Hostinger Passenger deployment validation (`backend/passenger_wsgi.py`), admin build under the
  production Node version.
- Validate Gemini `SUGGEST_ONLY` end to end and surface Aria suggestions in `ai_support_logs`.

### P2
- Hero heading contrast on `hero-gradient` pages (`/accounting`, `/founder-club`) — white text on
  a pale gradient is close to unreadable.
- Recurring/subscription billing for the monthly services (auditing, bookkeeping).
- Founder Club member pricing automatically applied at checkout.
