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
- Recommendations must return **exactly three** valid, active, non-duplicate recommendations
  with canonical prices.
- Required published starting prices:
  - Corporate Tax Registration — **AED 1,000 one-time**
  - Corporate Tax Filing — **AED 1,000 starting / per filing**
  - Auditing — **AED 1,500/month starting**
  - Bookkeeping — **AED 1,200/month starting**
  - Founder Club membership — **AED 999 one-time**, purchasable standalone
- No mock/demo data. One canonical price source. No secrets in source.

---

## Implemented

### 2026-06 — Phase 0 + 1: architecture audit
`/app/docs/`: `PRODUCTION_AUDIT.md`, `ARCHITECTURE.md`, `ENVIRONMENT.md`, `PRICING_AUDIT.md`,
`API_MAP.md`, `TEST_PLAN.md`, `DEPLOYMENT.md`. 97 backend routes mapped.

### 2026-06 — Phase 2: security, server-side orders, service catalog, Founder Club
Tested in `/app/test_reports/iteration_2.json` (backend 12/12, frontend 100%).
1. **Internal-note leak fixed** — `support.py::one_ticket` drops `from_role == "internal"` for
   non-staff. Proven by `backend/tests/test_internal_notes.py`.
2. **Server-side orders** — `POST /api/orders` re-prices from canonical sources, snapshots line
   items into Mongo `order_snapshots`, writes Supabase `checkout_orders` with the service role.
   Client-supplied prices are ignored (forged `price_aed: 1` still charged AED 1,000).
3. **Service catalog** — Mongo `service_catalog`, `GET /api/services`, admin CRUD at
   `/admin/services`.
4. **New `/accounting` page** — the four accounting services purchasable standalone.
5. **Founder Club AED 999 standalone** — server-priced, then Stripe against that `order_ref`.
6. **Post-payment fulfilment** (`backend/fulfillment.py`, idempotent) — client-portal account,
   `founder_club_memberships` row, Resend welcome + confirmation emails (both verified delivered).
7. Fixed: `email_logs` duplicate-key crash on every 2nd email; missing
   `/api/admin/email-logs/stats` and `/api/admin/ai-support/logs`; Email Health field-name
   mismatch; hardcoded `sk_test_emergent` Stripe fallback removed.

### 2026-06 — Phase 3: catalog migration, DIFC/ADGM, ticket unification, Founder discount
Tested in `/app/test_reports/iteration_3.json` (29/29 pytest, frontend 100%).
1. **BUG FIXED — DIFC/ADGM prices missing.** RCA: DIFC and ADGM existed only as Home-page
   marquee logos and as `allowedSlugs: ['difc','adgm']` in the AI activity-search rules. There
   was no jurisdiction entry, no packages and no database rows, so regulated-financial searches
   resolved to two priceless jurisdictions. Both are now full jurisdiction profiles with
   government fees researched from the official DIFC ROC and ADGM fee schedules (USD converted
   at 1 USD = 3.6725 AED): DIFC from **AED 16,900** (Innovation Licence), ADGM from
   **AED 7,350** (Hub71 tech startup). DFSA / FSRA Category A licences are `pricing_mode:
   on_request` and render **"Price on request"** — never AED 0, never chosen as a "from" price,
   and rejected by `POST /api/orders` with a message asking for an enquiry.
2. **Hardcoded prices killed.** `data/zones.js` (25 jurisdictions) and
   `data/freezonePackages.js` (52 entries) no longer contain a single price literal — they are
   re-exports of a live store (`data/catalog.js`) fed by `GET /api/catalog`. Canonical data lives
   in Mongo `jurisdiction_catalog`, `package_catalog`, `addon_catalog`,
   `package_addon_catalog`, `package_discount_catalog`, seeded from `backend/seed_data/*.json`
   plus a one-time import of the legacy Supabase `freezone_packages` rows (126 packages,
   12 free zones, 3 mainland, 13 coming-soon, 17 add-ons). `CatalogGate` in `App.js` blocks route
   rendering until prices load and shows a retry state if they can't.
3. **Admin Price Catalog** at `/admin/catalog` — packages tab (edit price, name, pricing mode,
   activate/deactivate, create) and jurisdictions tab (gov / gov+visa / service fee / status).
   Founder writes, manager reads. Edits appear on the website immediately.
4. **Ticket storage unified** — `admin/lib/tickets/ticketService.js` already operated on
   `support_tickets` / `support_messages`; the one stray `col('tickets')` priority patch was
   repointed, so admin and the customer portal are guaranteed to show one identical thread.
5. **Founder Club discount** — 15% off catalog services, 10% off setup packages, for active
   members; the membership itself is never discounted. `GET /api/orders/founder-status?email=`
   drives member pricing and an upsell banner on `/accounting`.
6. Removed the remaining `AED 0` service-fee lines on free-zone detail and `/compare` (now
   "Included").

---

## Environment notes / blockers (user action required)
- **Mongo Atlas unusable**: `smartsetupuae.ovxfmoi.mongodb.net` does not resolve (cluster
  paused, renamed or deleted). Preview runs on local Mongo; URI parked as `MONGO_URL_ATLAS`.
- **Resend domain unverified**: only delivers to `pankajdxb555@gmail.com`.
  `RESEND_FORCE_FROM=onboarding@resend.dev` keeps sends working — remove after verifying.
- **Stripe subscriptions blocked**: the user pasted a **live** `sk_live_` key in chat. It must be
  revoked. Monthly billing needs a `sk_test_` key before it can be built.
- Secrets pasted in chat (Supabase service-role, Resend, admin JWT, Atlas password, Stripe live)
  should all be rotated.
- `@supabase/supabase-js` pinned to `2.108.2` — 2.110+ requires Node ≥22, pod has Node 20.

---

## Backlog

### P0
- **Monthly subscriptions** for Auditing / Bookkeeping — real Stripe Subscriptions with monthly
  invoices, cancel/pause and a customer billing portal. Blocked on a `sk_test_` key.
- Resolve the Atlas cluster host and cut over from local Mongo.
- Verify `smartsetupuae.ae` in Resend, drop `RESEND_FORCE_FROM`, prove webhook status
  idempotency (`webhooks_resend.py`) end to end.
- Real DIFC/ADGM commercial package prices from the user (currently government fees only).

### P1
- Centralise all Resend sends behind one function (still duplicated across
  `admin_security.py`, `careers.py`, `email_logs.py`, `notifications.py`, `admin/lib/email.js`,
  `admin/lib/emailService.js`, `admin/lib/support/supportEmail.js`).
- SLA cron (`/api/sla/tick`, `SLA_CRON_KEY`) wired and proven on Hostinger.
- Hostinger Passenger deployment validation (`backend/passenger_wsgi.py`) and an admin
  production build on the production Node version.
- Validate Gemini `SUGGEST_ONLY` end to end (`ai_support_logs` is still empty).
- Audit the imported Supabase packages for data quality (e.g. DMCC partner workspace packages
  priced from AED 1,925 dominate the DMCC "from" price).

### P2
- Hero heading contrast on `hero-gradient` pages (`/accounting`, `/founder-club`).
- Founder Club member pricing shown on free-zone and checkout pages too, not just `/accounting`.
- Retire `frontend/src/mock.js` (`FREE_ZONES`) — the last remaining non-canonical zone data.
