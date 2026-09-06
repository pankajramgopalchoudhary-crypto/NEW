# SmartSetupUAE — Handoff (June 2026)

Download the code with **Save to GitHub** (chat input bar) → then download the ZIP from GitHub.
A local archive is also at `/app/smartsetupuae-full-source.zip` (excludes node_modules/.next/__pycache__).

## Stack / layout
```
/app/frontend   React customer portal (CRA, port 3000)   — REACT_APP_BACKEND_URL
/app/backend    FastAPI (port 8001, supervisor)          — MONGO_URL, DB_NAME=smartsetupuae
/app/admin      Next.js 15 admin (NOT supervised here; run: npx next dev -p 3100)
```
Data: Supabase (auth, Postgres, storage bucket `cilents-documents`) + MongoDB (tickets, AI logs, SLA).

## DONE this session
1. **Recommendation engine**
   - `frontend/src/lib/activitySearchService.js`: new `rankActivities()` — exact > starts-with >
     whole-word > substring, per-word hits, de-dupe by activity name. Fixes loose `ilike *term*`
     matches (searching "VARA" no longer returns unrelated rows).
   - Regulated activities with no live package now still surface the authorised zones (DMCC/ADGM/DIFC).
2. **Start Application fixed** (`frontend/src/components/AISearch.jsx`)
   - Checkout now receives `freezone=<slug>` **and** `package=<uuid>` (previously a zone *name*,
     which never matched → blank checkout). Lead-capture failure no longer blocks navigation.
   - Verified: /ai-search?q=Gold Trading → Start Application → /checkout with DMCC Nook AED 10,345.
3. **Checkout ↔ admin ↔ dashboard alignment**
   - Orders now persist `order_ref`; Dashboard/AdminPanel read `final_total`/`freezone`/`package_name`/`order_ref`
     (were reading non-existent `total_aed`/`zone_name`/`reference` → AED 0 / blank refs).
   - Admin API revenue + client totals use `final_total`; prebook count uses `status=payment_review`
     (there is no `booking_type` column).
4. **Attachment previews** — image thumbnails via signed URL + file-size badges in customer
   (`SupportPortal.jsx`) and admin (`app/admin/tickets/[id]/page.js`); admin sign-upload now validates
   MIME + 10 MB; bucket switched to the only existing one: `cilents-documents` (png/jpeg/webp/pdf).
5. **Auto-Reply Mode** — `backend/ai_support.py` gate = allow-listed category (ticket + AI-detected)
   AND allowed priority AND confidence ≥ threshold (default 0.8) AND not requires_human; auto-replied
   tickets can auto-resolve. Admin UI: **Support Analytics → Aria Auto-Reply Mode** card
   (Off / Suggest only / Auto-reply, confidence slider, category + priority chips). Default: Suggest only.
6. **Per-zone investor visa price (no longer static)** — seeded the empty Supabase `freezone_pricing`
   table; `getVisaPrice(freezone)` reads it live (IFZA now AED 5,750 vs old flat 5,912).
   New admin editor: **Admin → Pricing → Per-Zone Government Costs**
   (`GET/PATCH /api/admin/pricing/visa-costs`).
   ⚠️ DMCC / DAFZA / Meydan were seeded with the 5,912 default + a "please review" note — the derived
   values (25,219 / 22,508) came from premium 1-visa packages and are wrong. **Owner must enter real numbers.**
7. Bug fix: `GET /api/support/tickets/by-user/{email}` returned nothing (missing `return`).

Tested: backend pytest 8/8 (auto-reply gating, ticket create, attachments validation, smart-rank,
analytics) + frontend flows (AI search, VARA guardrail, Start Application → checkout, mobile 390px).
Report: `/app/test_reports/iteration_1.json`.

## IN PROGRESS — Phase 1 of the Python → Node migration
Goal (user decision): move FastAPI into the Next.js app so everything deploys to a JS-only host.
FastAPI keeps running in parallel until each phase is verified. The Next.js app **does run locally**
(`cd /app/admin && npx next dev -p 3100`) so ported endpoints are testable with curl.

Written already (`/app/admin/lib/support/`):
- `customerAuth.js` — Supabase JWT → {id,email,role}, `isStaff()`
- `gemini.js` — `geminiText()`, `geminiJson()` (model fallback + 503 retry + loose JSON parse)
- `aiSupport.js` — config (get/patch), high-risk regexes, `suggestReply()` with the same auto-reply gate
- `supportEmail.js` — Resend send + `email_logs` entry

### STILL TO DO (Phase 1)
- `lib/support/slaEngine.js` — port `backend/sla.py`: DEFAULT_POLICIES, business-hours math
  (`_add_business_hours`), `computeDeadlines()`, `slaTick()` (healthy→warning→at_risk→breached with
  `sla_events` unique index for idempotency) and `renewalReminders()` (30/14/3-day tickets).
- `lib/support/customerTickets.js` — port `backend/support.py`: create (SUP-###### counter via
  `counters` collection, first customer message, AI suggestion + AUTO_REPLY path, confirmation email,
  Supabase Realtime broadcast), list, get, addMessage, claim, patch, sign-upload/sign-download, analytics.
- `lib/support/ariaEngine.js` — port `backend/aria.py`: `smartRank()` (same ranking system prompt +
  live pricing snapshot), `saveLead()`, chat (SSE stream + `aria_conversations` memory).
- Route handlers under `/app/admin/app/api/`:
  `support/tickets/route.js`, `support/tickets/[tid]/route.js`, `.../messages`, `.../claim`,
  `.../attachments/sign-upload`, `.../attachments/sign-download`, `support/tickets/by-user/[email]`,
  `support/analytics`, `aria/chat` (SSE), `aria/smart-rank`, `aria/save-lead`, `sla/tick`, `cron/sla`.
  (Static routes take precedence over the existing `api/[[...path]]` catch-all.)
- `vercel.json` with a cron hitting `/api/cron/sla` every 15 min (replaces the Hostinger cron).
- Keep the SAME Mongo collections so both backends share data: `support_tickets`, `support_messages`,
  `counters`, `sla_policies`, `sla_events`, `ai_support_config`, `ai_support_logs`,
  `renewal_reminders`, `aria_conversations`. `admin/.env` now has MONGO_URL/DB_NAME/RESEND/SLA_CRON_KEY filled.
- Then: point `frontend/.env` REACT_APP_BACKEND_URL at the Node host and re-test end to end.

### Phases 2-4 (not started)
- **Phase 2**: lifecycle (progress, vault, compliance, renewals, invoices), referrals, careers, auth bridge.
- **Phase 3**: Stripe payments, notifications (Resend/WhatsApp), admin OTP/audit/invoice PDFs.
- **Phase 4**: OCR + passport photo (Python imaging/AI — need a Node/API replacement), then cutover
  and delete `/app/backend`.
Total remaining surface: ~6,200 lines of Python / ~110 endpoints across 24 modules.

## Known issues / notes
- Supabase has **no `licenses` table** → renewal reminders scan is skipped (set `RENEWAL_SOURCE_TABLE`
  to the real table, or create it).
- Only storage bucket is `cilents-documents` (typo in the original project) — png/jpeg/webp/pdf, 10 MB.
- DMCC / DAFZA / Meydan visa costs need real values (see item 6).
- Admin "Generate AI reply" button calls the FastAPI endpoint; after migration it must point to the
  ported `/api/admin/ai-support/suggest/[id]`.
- Credentials: `/app/memory/test_credentials.md`. PRD: `/app/memory/PRD.md`.
