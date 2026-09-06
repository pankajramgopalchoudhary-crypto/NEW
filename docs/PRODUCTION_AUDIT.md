# SmartSetupUAE — Production Audit (Phase 0 + Phase 1)

Date: June 2026 · Source: `https://github.com/pankajramchoudhary-byte/NEW-PROJECT.git` (branch `main`, shallow clone)
Workspace: `/app/backend` (FastAPI), `/app/frontend` (CRA/CRACO), `/app/admin` (Next.js 15).

Status legend: PASS · FAIL · FIXED · WARNING · MANUAL ACTION REQUIRED

---

## 0. Baseline

| Item | Finding |
|---|---|
| Branch | `main` (single branch, shallow) |
| Env files committed | None (`.gitignore` covers `.env`, `.env.*`, `*.env`, `memory/test_credentials.md`) — PASS |
| Hardcoded secrets in repo | **FAIL** — `admin/DEPLOY_README.md` lines 43–45 contain a real Resend key (`re_4PWcv…`) and a Gemini key (`AQ.Ab8RN6…`). Both must be considered leaked and ROTATED. Backend `payments.py` defaults `STRIPE_API_KEY` to `sk_test_emergent` (placeholder, not a secret). |
| Previous docs | `HANDOFF.md`, `memory/PRD.md`, `admin/DEPLOY_README.md`, `test_result.md` — preserved, not deleted |
| Prior migration work | `HANDOFF.md` describes an **in-progress Python → Node migration** (porting FastAPI into Next.js). This audit does NOT continue that migration: the task mandates keeping FastAPI as `api.smartsetupuae.ae`. The partially ported modules in `admin/lib/support/*` remain but are treated as duplicates to be retired (see §3). |

## 1. What exists

### 1.1 Frameworks
| App | Framework | Entry | Port (local) | Env convention |
|---|---|---|---|---|
| Customer site | React 18 + CRA 5 + CRACO 7, react-router 7, Tailwind/shadcn | `frontend/src/index.js` | 3000 | `REACT_APP_*` (confirmed: `REACT_APP_BACKEND_URL`, `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`). **No** `NEXT_PUBLIC_*` or `REACT_APP_API_URL` usage. |
| Admin | Next.js 15.5 (App Router, JS), Tailwind/shadcn, `mongodb` driver, `jsonwebtoken`, `bcryptjs` | `admin/app/layout.js`, API in `admin/app/api/[[...path]]/route.js` | 3100 (not supervised) | `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_API_BASE` (email-health only) + server-only secrets |
| Backend | FastAPI 0.110 + Motor + httpx, Passenger via `a2wsgi` | `backend/server.py`, `backend/passenger_wsgi.py` | 8001 | `os.environ` + `python-dotenv` |

### 1.2 Backend modules (24) — 97 routes, all under `/api`
See `API_MAP.md`. Highlights: `support.py` (tickets), `sla.py`, `ai_support.py`, `email_logs.py`, `webhooks_resend.py`, `payments.py` (Stripe via emergentintegrations), `auth_bridge.py` (signup), `admin_security.py` (admin OTP/audit/invoices), `admin_packages.py`, `admin_extras.py` (dashboard stats + **dummy seeder**), `lifecycle.py`, `referral.py`, `careers.py`, `notifications.py`, `notify_router.py`/`notify_triggers.py`, `aria.py` (AI chat/smart-rank), `ocr.py`, `photo.py`, `guides.py`, `download.py`, `admin_users.py`.

### 1.3 Data stores (both used, intentionally)
**Supabase (Postgres + Auth + Storage)** — canonical *business* data:
`profiles` (roles: client/admin/manager/staff/reviewer), `checkout_orders`, `checkout_order_addons`, `payments`, `payment_proofs`, `freezone_packages`, `freezone_pricing`, `package_discounts`, `coupons`, `leads`, `activities_master`, `documents`, `kyc_documents`, `founder_club_tiers`, `founder_club_memberships`, `memberships`, `reminders`, `notification_preferences`, RPC `recalculate_checkout_order`, storage buckets `cilents-documents` (sic), `payment-proofs`. Auth: Supabase GoTrue (email+password, OAuth callback).

**MongoDB (`DB_NAME=smartsetupuae`)** — operational/extension data:
`support_tickets`, `support_messages`, `counters` (SUP-###### sequence), `sla_policies`, `sla_events`, `ai_support_config`, `ai_support_logs`, `email_logs`, `resend_webhook_events`, `payment_transactions`, `admin_users` (admin Next.js only), `admin_otps`, `audit_log`, `invoices`, `application_progress`, `appointments`, `document_vault`, `compliance_status`, `renewals`, `client_profiles_ext`, `referral_codes`, `referrals`, `referral_rewards`, `golden_visa_leads`, `career_jobs`, `career_applications`, `aria_conversations`/`aria_chats`, `seo_meta`, `legal_pages`, `site_config`, `renewal_reminders`, `status_checks`.

### 1.4 Environment variables discovered
See `ENVIRONMENT.md` (full list per app). Backend: 37 distinct names; frontend: 3 app vars; admin: 17.

## 2. What works (static review; live verification in later phases)
- Backend modular routers all mount under `/api`; security headers middleware; slowapi rate limiting (120/min in-memory).
- Support tickets: atomic `SUP-######` counter via `counters.find_one_and_update` (PASS for Phase 32), staff/customer role resolution via Supabase JWT → `profiles.role`.
- SLA engine: default policies match spec (LOW 24/72, MEDIUM 8/48, HIGH 2/12, URGENT 0.5/4, warn 50%, at-risk 80%, `SUPPORT_TIMEZONE` default `Asia/Dubai`), `sla_events` idempotency, `/api/sla/tick` exists.
- AI support: default `SUGGEST_ONLY`, threshold 0.80, high-risk regex → `requires_human`; AUTO_REPLY gated by admin config.
- Email: `email_logs.log_email/mark_sent/mark_failed/update_status_by_provider_id` central log; `notifications.send_and_log_email` wraps Resend; alias allow-list matches spec (+`careers`).
- Resend webhook: svix signature verification (when secret set), event idempotency via unique `event_id`, event→status map.
- Payments: Stripe Checkout via emergentintegrations; `payment_transactions` in Mongo; re-fetches `checkout_orders.final_total` when `order_ref` given; on paid → PATCH Supabase order `status=paid` + notifications + referral conversion.
- Admin Next.js: own JWT (8h, HttpOnly cookie `ss_admin`), bcrypt passwords, 4 roles (founder/manager/staff/reviewer), 60+ API routes with `requireRole`.

## 3. What is broken / risky (to fix in later phases)

| # | Severity | Finding | Location | Phase |
|---|---|---|---|---|
| B1 | **CRITICAL** | Internal notes leak to customers: `GET /api/support/tickets/{tid}` returns all `support_messages` including `from_role:"internal"`. `by-user` listing may also. | `backend/support.py` L299-315 | 31 |
| B2 | **CRITICAL** | Leaked Resend + Gemini keys in committed doc | `admin/DEPLOY_README.md` L43-45 | 4 |
| B3 | **CRITICAL** | Orders are created **from the browser** directly into Supabase `checkout_orders` with client-computed `final_total` (anon key). Backend only re-validates when `order_ref` provided; `amount_aed` from frontend is otherwise trusted. Violates rule 19/20. | `frontend/src/lib/checkoutSupabase.js`, `backend/payments.py` L89-96 | 14, 19, 25 |
| B4 | HIGH | **Three admin surfaces**: (a) Next.js admin with its own auth (`admin_users` in Mongo, ADMIN_JWT_SECRET); (b) FastAPI admin OTP auth (`/api/admin/auth/otp/*`, Supabase `profiles.role` + `X-Admin-Token`); (c) legacy React `/admin` + `/admin/login` pages inside the customer site. Rule 8 (no duplicate auth) violated. | `admin/lib/auth.js`, `backend/admin_security.py`, `frontend/src/pages/AdminPanel.jsx`, `AdminLogin.jsx` | 6, 40 |
| B5 | HIGH | **Admin does not call `api.smartsetupuae.ae`**. Admin pages fetch relative `/api/...` served by Next.js route handlers that talk to Mongo/Supabase directly with the service-role key — a second backend. Only `email-health` uses `NEXT_PUBLIC_API_BASE`. Ticket/AI/email logic is duplicated in `admin/lib/support/*`, `admin/lib/tickets/ticketService.js`, `admin/lib/emailService.js`, `admin/lib/email.js`. | `admin/app/api/[[...path]]/route.js` (1113 lines) | 2, 8, 31, 40 |
| B6 | HIGH | Duplicate email senders: 4 Python callers hit Resend (`notifications.py` central; `admin_security.py`, `careers.py` direct) and 3 JS senders in admin. Rule 11. | listed | 8 |
| B7 | HIGH | CORS: default `CORS_ORIGINS='*'` with `allow_credentials=True`; strict list only if `CORS_STRICT=1`; no whitespace trimming. | `backend/server.py` L218-230 | 5 |
| B8 | HIGH | Customer auth gaps: no forgot/reset password UI, no OTP/email-verification flow — signup **auto-confirms** email via service role (`auth_bridge.py`) so "verified/unverified" state is meaningless. Profile creation happens client-side. | `auth_bridge.py`, `AuthContext.jsx`, `Login.jsx` | 7, 11, 12 |
| B9 | HIGH | Hardcoded pricing in frontend: `data/freezonePackages.js` (81 price literals), `data/zones.js` (26), `mock.js`, `ServicePage.jsx` (accounting/tax ranges as strings), `Checkout.jsx`, `CostCalculator.jsx`. Canonical DB source is Supabase `freezone_packages`/`freezone_pricing`, but static fallbacks compete. | frontend | 21, 43 |
| B10 | HIGH | Required accounting services (Corporate Tax Registration/Filing, Auditing, Bookkeeping) exist only as **marketing text** in `ServicePage.jsx`; not in any purchasable service catalog; no standalone checkout. | `ServicePage.jsx` | 22-24 |
| B11 | MEDIUM | Recommendation engine (`aria.smart-rank` + `activitySearchService.rankActivities`) does not enforce exactly 3 results. | `backend/aria.py`, `frontend/src/lib/activitySearchService.js` | 27-29 |
| B12 | MEDIUM | `admin_extras.py` dummy seeder (`POST /api/admin/seed/dummy`) can inject fake leads/orders in production. | `backend/admin_extras.py` | 13, 38 |
| B13 | MEDIUM | Resend webhook accepts **unsigned** events when `RESEND_WEBHOOK_SECRET` unset (logs warning). | `webhooks_resend.py` L92-96 | 10 |
| B14 | MEDIUM | Stripe webhook route is `/api/payments/webhook/stripe` but `webhook_url` passed to Stripe is `/api/webhook/stripe` (mismatch). Payment status relies on client polling `checkout/status`. | `payments.py` L118, L220 | 19-20 |
| B15 | MEDIUM | `/api/sla/tick` security: uses `SLA_CRON_KEY` header — verify enforcement; `admin/lib` ported `slaEngine` not present. | `sla.py` | 35 |
| B16 | MEDIUM | AI provider inconsistency: backend `ai_support.py` uses `EMERGENT_LLM_KEY` + Claude Haiku; `aria.py` uses Gemini/EMERGENT; admin uses `GEMINI_API_KEY`. Spec: Gemini via `GEMINI_API_KEY`. | `ai_support.py` L23,143-146 | 36 |
| B17 | LOW | Rate limiter in-memory (not shared across Passenger workers). | `server.py` | 47 |
| B18 | LOW | CSP `connect-src` allows `*.emergentagent.com` (dev host); CORS strict list contains a preview URL. | `server.py` | 5 |
| B19 | LOW | `download.py` exposes `/api/download/latest` project ZIP + `/rebuild` — must be disabled in production. | `download.py` | 47 |
| B20 | LOW | Supabase has no `licenses` table → renewal reminders skipped (`RENEWAL_SOURCE_TABLE`). | `sla.py` | 34 |
| B21 | INFO | Admin `DB_NAME` documented as `smartsetupuae_admin` in DEPLOY_README vs backend `smartsetupuae` → tickets/email logs would live in different databases. Must be the same DB. | `admin/DEPLOY_README.md` | 3 |

## 4. What is missing
- Customer password reset / change / OTP verification (Phase 7, 11, 12).
- Server-side order creation endpoint + canonical order model with price snapshot (Phase 14-15).
- Service catalog (services table/collection) with the 4 accounting services and standalone checkout (Phase 22-24).
- Exactly-3 recommendation contract (Phase 27).
- Admin Email Health/Test Center wired to backend (partially present: `admin/app/admin/email-health/page.js` uses `NEXT_PUBLIC_API_BASE`) (Phase 9).
- Customer 360 view in admin (Phase 39): `clients` page exists but doesn't aggregate tickets/emails/payments.
- Audit log coverage for order/payment/pricing changes (Phase 41).
- `/docs/*` (created now).

## 5. Phase 0/1 result
PHASE: 0 + 1 · STATUS: **PASS (audit complete)** · FILES CHANGED: none in app code; repo copied into `/app/{backend,frontend,admin}`; docs created under `/app/docs` · DATABASE CHANGES: none · API CHANGES: none · TESTS RUN: static analysis + dependency install · REMAINING ISSUES: B1–B21 above, scheduled by phase.
