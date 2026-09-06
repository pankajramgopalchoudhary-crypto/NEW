# SmartSetupUAE — Product Requirements & Status

## Original problem statement
Audit and production-harden the existing SmartSetupUAE platform (repo:
`pankajramchoudhary-byte/NEW-PROJECT`). Do **not** rebuild.

| Surface | Stack | Path | Production domain |
|---|---|---|---|
| Customer site | React (CRA/CRACO) | `/app/frontend` | `smartsetupuae.ae` |
| Admin console | Next.js 14 (app router) | `/app/admin` (port 3001 in preview) | `admin.smartsetupuae.ae` |
| API | FastAPI + Motor | `/app/backend` | `api.smartsetupuae.ae` |

Data: **MongoDB** (canonical operational data + catalogs) + **Supabase** (auth, checkout orders).
Integrations: Resend (email + webhook status), Stripe (payments), Gemini AI support (`SUGGEST_ONLY`).

### Hard acceptance gates
- Recommendations must return **exactly three** valid, active, non-duplicate recommendations.
- Required published starting prices: Corporate Tax Registration **AED 1,000 one-time**,
  Corporate Tax Filing **AED 1,000 starting / per filing**, Auditing **AED 1,500/month**,
  Bookkeeping **AED 1,200/month**, Founder Club **AED 999 one-time** (standalone).
- No mock/demo data. One canonical price source. No secrets in source.
- **Founder Club discount rule:** 15% off catalog services, 10% off setup packages; the
  membership itself is never discounted.

---

## Implemented

### 2026-06 — Phase 0 + 1: architecture audit
`/app/docs/`: `PRODUCTION_AUDIT.md`, `ARCHITECTURE.md`, `ENVIRONMENT.md`, `PRICING_AUDIT.md`,
`API_MAP.md`, `TEST_PLAN.md`, `DEPLOYMENT.md`. 97 backend routes mapped.

### 2026-06 — Phase 2 (tests: `iteration_2.json`, 12/12 backend, frontend 100%)
1. **Internal-note leak fixed** — `support.py::one_ticket` drops `from_role == "internal"` for
   non-staff (`backend/tests/test_internal_notes.py`).
2. **Server-side orders** — `POST /api/orders` re-prices from canonical sources, snapshots line
   items to Mongo `order_snapshots`, writes Supabase `checkout_orders` with the service role.
   Forged client prices are ignored.
3. **Service catalog** — Mongo `service_catalog`, `GET /api/services`, admin CRUD `/admin/services`.
4. **New `/accounting` page** — the four accounting services purchasable standalone.
5. **Founder Club AED 999 standalone** — server-priced, then Stripe against that `order_ref`.
6. **Post-payment fulfilment** (`fulfillment.py`, idempotent) — client-portal account,
   `founder_club_memberships` row, Resend welcome + confirmation emails (verified delivered).
7. Fixed: `email_logs` duplicate-key crash on every 2nd email; missing
   `/api/admin/email-logs/stats` and `/api/admin/ai-support/logs`; Email Health field mismatch;
   hardcoded `sk_test_emergent` Stripe fallback removed.

### 2026-06 — Phase 3 (tests: `iteration_3.json`, 29/29 backend, frontend 100%)
1. **BUG FIXED — DIFC/ADGM prices missing.** RCA: they existed only as homepage marquee logos
   and an `allowedSlugs: ['difc','adgm']` AI-search rule; no jurisdiction record, no packages,
   no rows. Now full profiles with fees from the official DIFC ROC / ADGM 2026 schedules
   (1 USD = 3.6725 AED): DIFC from **AED 16,900**, ADGM from **AED 7,350**, 9 packages.
   DFSA/FSRA Category A are `pricing_mode: on_request` → "Price on request", rejected at
   checkout with an enquiry prompt.
2. **Hardcoded prices killed.** `data/zones.js` / `data/freezonePackages.js` hold zero price
   literals; they re-export a live store (`data/catalog.js`) fed by `GET /api/catalog`.
   Canonical: Mongo `jurisdiction_catalog`, `package_catalog`, `addon_catalog`,
   `package_addon_catalog`, `package_discount_catalog`, seeded from `backend/seed_data/*.json`
   plus a one-time import of the legacy Supabase `freezone_packages` rows. `CatalogGate` in
   `App.js` blocks route render until prices load, with a retry state on failure.
3. **Admin Price Catalog** `/admin/catalog` — packages tab (price, name, pricing mode,
   activate, create) + jurisdictions tab (gov / gov+visa / service fee / status). Founder
   writes, manager reads.
4. **Ticket storage unified** — one stray `col('tickets')` write repointed to `support_tickets`.
5. **Founder Club discount** — implemented with `GET /api/orders/founder-status`.

### 2026-06 — Phase 4 (tests: `iteration_4.json`, 44/44 backend, frontend 100%)
1. **BUG FIXED — DMCC price wrong.** DMCC showed "FROM AED 1,925" (an AstroLabs partner
   co-working listing) and carried an AED 0 "Uptown Homeowners Package" plus 2/3-year terms.
   New idempotent `_apply_data_quality()` in `catalog.py` (`PACKAGE_EXCLUSIONS`,
   `DURATION_ALLOWLIST = {'DMCC': {'1 Year'}}`) deactivates those rows. DMCC now runs
   **Nook Package AED 10,345 → Jump Start AED 43,780, 1-Year only** (12 packages). Every other
   zone's count is unchanged; total active packages 126 → 118. Deactivated rows are still
   visible as "Off" in the admin Price Catalog.
2. **Member pricing everywhere** — free-zone detail shows the discounted selected total with
   the original struck through and a "Founder Club — save AED X (10%)" line
   (`fz-total`, `fz-founder-saving`); `/checkout` adds a "Founder Club member discount (10%)"
   line to the order summary. Displayed totals match what `POST /api/orders` charges exactly
   (verified: Nook 10,345 → 9,310.50).
3. Zero-price packages are globally forced to `on_request` so nothing can ever render AED 0.

---

## Environment notes / blockers (user action required)
- **Mongo Atlas unusable**: `smartsetupuae.ovxfmoi.mongodb.net` does not resolve. Preview runs
  on local Mongo; URI parked as `MONGO_URL_ATLAS`.
- **Resend domain unverified**: only delivers to `pankajdxb555@gmail.com`.
  `RESEND_FORCE_FROM=onboarding@resend.dev` keeps sends working.
- **Stripe subscriptions blocked**: the user pasted a **live** `sk_live_` key in chat (must be
  revoked). Monthly billing needs a `sk_test_` key.
- All secrets pasted in chat should be rotated (Supabase service-role, Resend, admin JWT,
  Atlas password, Stripe live).
- Code export: Emergent has no ZIP download — use **Save to GitHub** (paid plan) then clone.
- `@supabase/supabase-js` pinned to `2.108.2` — 2.110+ requires Node ≥22, pod has Node 20.

---

## Backlog

### P0
- **Monthly subscriptions** for Auditing / Bookkeeping — real Stripe Subscriptions with monthly
  invoices, cancel/pause and a customer billing portal. Blocked on a `sk_test_` key.
- Resolve the Atlas cluster host and cut over from local Mongo.
- Verify `smartsetupuae.ae` in Resend, drop `RESEND_FORCE_FROM`, prove `webhooks_resend.py`
  idempotency end to end.
- Real DIFC/ADGM commercial selling prices from the user (currently government fees only).

### P1
- Centralise all Resend sends behind one function (still duplicated across
  `admin_security.py`, `careers.py`, `email_logs.py`, `notifications.py`, `admin/lib/email.js`,
  `admin/lib/emailService.js`, `admin/lib/support/supportEmail.js`).
- SLA cron (`/api/sla/tick`, `SLA_CRON_KEY`) wired and proven on Hostinger.
- Hostinger Passenger deployment validation (`backend/passenger_wsgi.py`) and an admin
  production build on the production Node version.
- Validate Gemini `SUGGEST_ONLY` end to end (`ai_support_logs` still empty).
- Extend the data-quality rules to other zones (e.g. ANCFZ has 7 near-duplicate AED 4,888 rows).
- Price-history / audit trail on the Price Catalog with one-click rollback.

### P2
- Hero heading contrast on `hero-gradient` pages (`/accounting`, `/founder-club`).
- Retire `frontend/src/mock.js` (`FREE_ZONES`) — the last non-canonical zone data.
- Honour `?include_inactive=true` on the public `GET /api/catalog/packages` (admin uses its own
  endpoint, so this is cosmetic).
