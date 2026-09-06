# API Map — FastAPI (`api.smartsetupuae.ae`), 97 routes, all `/api/*`

Auth legend: **S** = Supabase JWT (customer/staff via `profiles.role`), **A** = FastAPI admin session (`X-Admin-Token` after OTP), **K** = cron key header, **P** = public, **W** = provider webhook.

| Module | Routes |
|---|---|
| server.py | P `GET /api/`, `POST/GET /api/status` (template — remove in prod) |
| auth_bridge.py `/api/auth` | P `POST /signup` (creates + auto-confirms + returns tokens), `POST /admin-confirm` (**unauthenticated** — lock down) |
| support.py `/api/support` | S `POST /tickets`, `GET /tickets` (staff), `GET /tickets/{tid}`, `POST /tickets/{tid}/messages`, `POST /tickets/{tid}/claim` (staff), `PATCH /tickets/{tid}` (staff; internal_note), `GET /tickets/by-user/{email}`, `POST /tickets/{tid}/attachments/sign-upload|sign-download`, `GET /analytics` |
| sla.py `/api/sla` | S `GET /policies`, `PATCH /policies/{id}`; K `POST /tick` |
| ai_support.py `/api/admin/ai-support` | S(staff) `GET/PATCH /config`, `GET /logs`, `POST /suggest/{ticket_id}` |
| email_logs.py `/api/admin/email-logs` | S(staff) `GET /`, `GET /stats`, `GET /{log_id}` |
| webhooks_resend.py | W `POST /api/webhooks/resend` |
| notifications.py `/api/notify` | `POST /email`, `POST /email/test`, `POST /whatsapp`, `GET/POST /whatsapp/webhook`, `POST /lead-alert` (auth to verify Phase 8) |
| notify_router.py `/api/notify-triggers` | `POST /lead-submitted, /order-placed, /doc-approved, /doc-rejected, /appointment-scheduled, /renewal-reminder, /founder-club-purchased`, `GET /status` |
| payments.py `/api/payments` | P `GET /currencies`, `POST /checkout/session`, `GET /checkout/status/{session_id}`; W `POST /webhook/stripe` |
| admin_packages.py `/api/admin/packages` | S(admin) `PATCH /{pkg_id}`, `DELETE /{pkg_id}` |
| admin_extras.py `/api/admin` | S(admin) `POST /seed/dummy`, `DELETE /seed/cleanup`, `GET /dashboard/stats` |
| admin_users.py `/api/admin` | S(admin) `GET/POST/PATCH /users` |
| admin_security.py | P `POST /api/admin/auth/otp/request`, `POST /api/admin/auth/otp/verify`; A `GET /api/admin/audit`, `GET/POST /api/admin/assignments`, `GET/POST /api/admin/invoices`, `GET /api/admin/invoices/{id}.pdf` |
| lifecycle.py `/api/lifecycle` | S `GET /progress/steps`, `GET/PATCH /progress`, `GET/POST /appointments`, `GET/PUT /profile`, `GET/POST /vault`, `GET /vault/{id}/download`, `DELETE /vault/{id}`, `GET/PUT /compliance`, `GET/POST /renewals`, `POST /golden-visa/lead`, `GET /golden-visa/leads`, `GET/POST /invoices` |
| referral.py `/api/referral` | S `GET /me`, `GET /lookup/{code}`, `POST /attach`, `GET /admin/list`, `PATCH /admin/reward/{id}/redeem` |
| careers.py | P `GET /api/careers/jobs`, `GET /api/careers/jobs/{id}`, `POST /api/careers/applications`; admin `GET/POST/PATCH/DELETE /api/admin/careers/jobs*`, `GET /api/admin/careers/applications` |
| aria.py `/api/aria` | P `POST /chat` (SSE), `POST /smart-rank`, `POST /save-lead` |
| ocr.py `/api/ocr` | P `GET /types`, `POST /parse` |
| photo.py `/api/photo` | P `POST /passportize` |
| guides.py `/api/guides` | P `GET /golden-visa.pdf` |
| download.py `/api/download` | `GET /latest`, `POST /rebuild` — **disable in production** |

# Admin Next.js route handlers (`admin/app/api/[[...path]]/route.js`) — duplicate backend
`/health`, `/admin/auth/{login,pin,me,logout,change-password}`, `/admin/stats/{overview,by-zone,pipeline,activities-count}`, `/admin/leads[/:id]`, `/admin/orders[/:id]`, `/admin/clients`, `/admin/documents[/:id]`, `/admin/payments[/:id]`, `/admin/invoices`, `/admin/pricing`, `/admin/pricing/bulk`, `/admin/pricing/visa-costs`, `/admin/freezone/:zone`, `/admin/packages/:id`, `/admin/coupons[/:code]`, `/admin/founders-club[/:id]`, `/admin/staff[/:id][/reset-pin]`, `/admin/settings`, `/admin/seed`, `/aria/chat`, `/admin/legal[/:slug]`, `/admin/seo[/:slug|/sitemap]`, `/admin/tickets`, `/admin/tickets/stats`, `/admin/tickets/create`, `/tickets/create`, `/admin/tickets/:id/{reply,notes,assign,status,attachments/*}`, `/admin/ai-support/config`, `/admin/support-analytics`, `/admin/email-logs`, `/admin/email/send`.

Decision (Phase 2/40): admin business APIs must converge onto FastAPI. Route handlers that only exist in Next.js (staff accounts, SEO, legal, settings, stats) will be either ported to FastAPI or kept as thin admin-only utilities with a documented rationale; ticket/email/AI/pricing/orders duplicates will be removed in favour of `NEXT_PUBLIC_API_URL`.

# Frontend → API usage (customer)
FastAPI: `/api/auth/signup`, `/api/support/*`, `/api/aria/*`, `/api/payments/*`, `/api/lifecycle/*`, `/api/ocr/*`, `/api/photo/passportize`, `/api/guides/golden-visa.pdf`, `/api/careers/*`, `/api/admin/*` (legacy React admin).
Supabase direct (anon + user JWT): auth (`/auth/v1/*`), `profiles`, `checkout_orders`, `checkout_order_addons`, `coupons`, `freezone_packages`, `freezone_pricing`, `package_discounts`, `activities_master`, `leads`, `memberships`, `kyc_documents`, `reminders`, `notification_preferences`, `payment_proofs`, storage `payment-proofs`, RPC `recalculate_checkout_order`.
