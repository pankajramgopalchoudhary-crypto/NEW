# Deployment (Hostinger)

## Runtime decision

The customer application currently depends on the FastAPI service in `backend/`.
Hostinger's Node.js-only platform does not execute Python, and the Next.js admin
API is not a replacement for that service: it does not implement the public
catalog, orders, checkout, lifecycle, OCR, referral, support, and payment
endpoints used by the customer frontend.

The current application therefore requires either a Python-capable API host or
a complete FastAPI-to-Node migration. Do not point `REACT_APP_BACKEND_URL` at
`admin.smartsetupuae.ae` until that migration implements the complete customer
API contract. See `docs/HOSTINGER_NODE_ONLY.md` for the exact acceptance gate.

| App | Host | Runtime | Root | Start |
|---|---|---|---|---|
| Customer | smartsetupuae.ae | static CRA build | `domains/smartsetupuae.ae/public_html` ← `frontend/build/*` | n/a (add SPA `.htaccess` rewrite to `index.html`) |
| Admin | admin.smartsetupuae.ae | Node 20/22/24, Next.js | `domains/admin.smartsetupuae.ae/public_html` | `npm run start` (`next start -p $PORT`) |
| API | api.smartsetupuae.ae | Hostinger Setup Python App / Passenger, Python 3.10 or 3.11 | `domains/api.smartsetupuae.ae/public_html` ← `backend/` | startup `passenger_wsgi.py`, entry `application` |

Backend note: `passenger_wsgi.py` wraps ASGI via `a2wsgi`. The API cannot run on a static-only Hostinger plan. If hPanel does not show **Setup Python App**, deploy the API to a Python-capable host and point `REACT_APP_BACKEND_URL` at it; do not upload the Python files as ordinary static files. SSE (`/api/aria/chat`) may buffer under WSGI and must be verified after deployment.

## Python API setup

1. Create a Python application in hPanel, using Python 3.10 or 3.11.
2. Set the application root to `domains/api.smartsetupuae.ae/public_html`.
3. Upload the contents of `backend/` into that root.
4. Set startup file to `passenger_wsgi.py` and entry point to `application`.
5. Run **Run Pip Install** against `requirements.txt` from the application panel.
6. Add the variables from `docs/ENVIRONMENT.md` in hPanel Environment Variables.
7. Restart the Python application and check the Passenger error log before testing the frontend.

The customer frontend remains a static build and the admin remains a Node.js application. They do not replace the Python API runtime.

Cron (Hostinger → every 10 min): `curl -s -X POST -H "X-Cron-Key: $SLA_CRON_KEY" https://api.smartsetupuae.ae/api/sla/tick`
Resend webhook: `https://api.smartsetupuae.ae/api/webhooks/resend` with signing secret → `RESEND_WEBHOOK_SECRET`.
Stripe webhook: `https://api.smartsetupuae.ae/api/payments/webhook/stripe` (route mismatch to fix in Phase 19).

Env: see `ENVIRONMENT.md`. Set in hPanel, never in files.
