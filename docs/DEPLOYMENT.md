# Deployment (Hostinger) — draft, finalised in Phase 48-49

| App | Host | Runtime | Root | Start |
|---|---|---|---|---|
| Customer | smartsetupuae.ae | static CRA build | `domains/smartsetupuae.ae/public_html` ← `frontend/build/*` | n/a (add SPA `.htaccess` rewrite to `index.html`) |
| Admin | admin.smartsetupuae.ae | Node 20/22, Next.js | `domains/admin.smartsetupuae.ae/public_html` | `yarn start` (`next start -p $PORT`) |
| API | api.smartsetupuae.ae | Python 3.11, Passenger | `domains/api.smartsetupuae.ae/public_html` ← `backend/` | startup `passenger_wsgi.py`, entry `application` |

Backend note: `passenger_wsgi.py` wraps ASGI via `a2wsgi`. SSE (`/api/aria/chat`) may buffer under WSGI — verify in Phase 48.

Cron (Hostinger → every 10 min): `curl -s -X POST -H "X-Cron-Key: $SLA_CRON_KEY" https://api.smartsetupuae.ae/api/sla/tick`
Resend webhook: `https://api.smartsetupuae.ae/api/webhooks/resend` with signing secret → `RESEND_WEBHOOK_SECRET`.
Stripe webhook: `https://api.smartsetupuae.ae/api/payments/webhook/stripe` (route mismatch to fix in Phase 19).

Env: see `ENVIRONMENT.md`. Set in hPanel, never in files.
