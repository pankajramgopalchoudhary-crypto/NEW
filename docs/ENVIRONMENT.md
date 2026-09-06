# Environment Variables (discovered from source, Phase 1)

Never put secrets in `REACT_APP_*` or `NEXT_PUBLIC_*`. Never commit `.env`.

## A. Backend (`/app/backend`, FastAPI) — `os.environ`
| Var | Required | Used in | Notes |
|---|---|---|---|
| MONGO_URL | yes | all modules | URL-encode special chars in password |
| DB_NAME | yes | all modules | `smartsetupuae` (admin must use the SAME name) |
| SUPABASE_URL | yes | auth_utils, support, payments, lifecycle, admin_* , aria, referral | |
| SUPABASE_SERVICE_ROLE_KEY | yes | same | server only |
| SUPABASE_ANON_KEY | yes | auth_bridge (signup/login) | public-safe but backend needs it |
| CORS_ORIGINS | yes | server.py | comma list; currently default `*` (fix Phase 5) |
| CORS_STRICT | opt | server.py | legacy toggle |
| RESEND_API_KEY | yes | notifications, admin_security, careers, email_logs | |
| RESEND_FROM_EMAIL | yes | notifications | e.g. `SmartSetupUAE <noreply@smartsetupuae.ae>` |
| RESEND_WEBHOOK_SECRET | yes (prod) | webhooks_resend | svix signing secret |
| NOTIFY_ADMIN_EMAIL | opt | notifications | lead alerts |
| GEMINI_API_KEY, GEMINI_MODEL | yes | aria, ocr/photo | |
| EMERGENT_LLM_KEY, LLM_PROVIDER | opt | ai_support, aria | to be replaced by GEMINI (Phase 36) |
| STRIPE_API_KEY | yes | payments | |
| EXCHANGE_RATE_API | opt | payments | default open.er-api.com |
| META_WA_TOKEN, META_WA_PHONE_NUMBER_ID, META_WA_VERIFY_TOKEN, ADMIN_NOTIFY_WHATSAPP | opt | notifications | WhatsApp |
| SLA_CRON_KEY | yes | sla | header for `/api/sla/tick` |
| SUPPORT_TIMEZONE | opt | sla | default `Asia/Dubai` |
| SUPPORT_ATTACHMENTS_BUCKET, SUPPORT_ATTACHMENT_MAX_BYTES | opt | support | bucket `cilents-documents`, 10 MB |
| RENEWAL_SOURCE_TABLE, RENEWAL_EXPIRY_FIELD | opt | sla | no `licenses` table exists |
| REFERRAL_REFERRER_PERCENT, REFERRAL_REFERRER_CASHBACK, REFERRAL_REFEREE_CASHBACK | opt | referral | |
| FOUNDER_EMAIL, FOUNDER_PASSWORD | opt | admin_security | admin OTP bootstrap |
| CAREER_INBOX, BRAND_LOGO_URL | opt | careers, guides | |
| REACT_APP_BACKEND_URL, REACT_APP_SUPABASE_ANON_KEY | opt | download.py, guides | backend reads frontend vars (cleanup) |
| PORT / NODE_ENV | n/a | not read by Python; Passenger manages port | harmless if set |

Local dev `.env` (this workspace) keeps `MONGO_URL`, `DB_NAME`, plus the above.

## B. Admin (`/app/admin`, Next.js)
Public: `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_API_BASE` (email-health) → to be standardised as **`NEXT_PUBLIC_API_URL`** (Phase 3), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
Server-only (currently required by route handlers): `MONGO_URL`, `DB_NAME`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_JWT_SECRET` (throws if missing), `FOUNDER_EMAIL`, `FOUNDER_PASSWORD`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_SUPPORT`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `CORS_ORIGINS`, `SUPPORT_ATTACHMENTS_BUCKET`.

## C. Customer frontend (`/app/frontend`, CRA)
Convention confirmed: **`REACT_APP_*`** only.
`REACT_APP_BACKEND_URL` (=`https://api.smartsetupuae.ae` in prod), `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`, `WDS_SOCKET_PORT` (dev), `ENABLE_HEALTH_CHECK`, `FAST_BUILD_VERIFY` (craco).
`REACT_APP_API_URL` / `REACT_APP_BASE_URL` are NOT referenced anywhere; do not introduce unless code needs them.

## Secret classification
PRIVATE: MONGO_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_JWT_SECRET, RESEND_API_KEY, RESEND_WEBHOOK_SECRET, GEMINI_API_KEY, EMERGENT_LLM_KEY, STRIPE_API_KEY, META_WA_TOKEN, SLA_CRON_KEY, FOUNDER_PASSWORD.
PUBLIC: Supabase URL, Supabase anon key, API/base URLs.

## Rotation required before production (leaked in `admin/DEPLOY_README.md` / dev history)
MongoDB password, Supabase service-role key, Resend API key, Gemini API key, ADMIN_JWT_SECRET.
