# SmartSetupUAE — Architecture (as-is, June 2026)

```
smartsetupuae.ae (CRA/CRACO React)            admin.smartsetupuae.ae (Next.js 15)
   |  REACT_APP_BACKEND_URL                        |  relative /api/* (Next route handlers)  <-- TARGET: NEXT_PUBLIC_API_URL -> api.
   |  REACT_APP_SUPABASE_URL + ANON (direct)       |  server-side: SUPABASE_SERVICE_ROLE_KEY, MONGO_URL
   v                                               v
api.smartsetupuae.ae (FastAPI, Passenger/a2wsgi)   admin/app/api/[[...path]]/route.js  (DUPLICATE backend — to retire/thin)
   +-- MongoDB  (motor, DB smartsetupuae)
   +-- Supabase (REST via httpx, service role; Auth via GoTrue)
   +-- Resend   (notifications.send_and_log_email -> email_logs)
   +-- Gemini / Emergent LLM (aria.py, ai_support.py, ocr.py, photo.py)
   +-- Stripe   (emergentintegrations StripeCheckout)
   +-- Meta WhatsApp Cloud (notifications.py)
   +-- open.er-api.com FX rates (payments.py)
```

## Responsibilities (preserve)
| Concern | Store | Owner code |
|---|---|---|
| Customer identity, roles | Supabase Auth + `profiles` | `auth_bridge.py`, `auth_utils.resolve_caller_role`, `AuthContext.jsx` |
| Packages / pricing / zones | Supabase `freezone_packages`, `freezone_pricing`, `package_discounts`, `coupons` | `admin_packages.py`, admin `/admin/pricing*`, frontend `pricingService.js`, `checkoutSupabase.js` |
| Orders | Supabase `checkout_orders` (+`checkout_order_addons`, RPC `recalculate_checkout_order`) | frontend `checkoutSupabase.js` (browser insert — to move server-side), `payments.py` (status→paid) |
| Payment transactions | Mongo `payment_transactions` (Stripe) + Supabase `payments`, `payment_proofs` (bank transfer) | `payments.py`, frontend `paymentProofs.js`, admin `/admin/payments` |
| Support tickets, SLA, AI | Mongo `support_tickets`, `support_messages`, `counters`, `sla_*`, `ai_support_*` | `support.py`, `sla.py`, `ai_support.py`; admin duplicates in `admin/lib/tickets`, `admin/lib/support` |
| Email log + delivery | Mongo `email_logs`, `resend_webhook_events` | `email_logs.py`, `notifications.py`, `webhooks_resend.py` |
| Admin staff accounts | Mongo `admin_users` (Next.js) **and** Supabase `profiles.role` (FastAPI) | `admin/lib/auth.js`, `admin_security.py` — duplicate, unify in Phase 6 |
| Lifecycle (progress, vault, compliance, renewals, invoices) | Mongo | `lifecycle.py`, `admin_security.py` (invoices PDF) |
| Referrals, careers, leads | Mongo (`referral_*`, `career_*`) / Supabase `leads` | `referral.py`, `careers.py`, `aria.py save-lead` |

## Realtime
Backend broadcasts ticket events via Supabase Realtime (`support._broadcast_ticket`); frontend subscribes with `supabaseClient.js`.

## Deployment (target)
- Backend: Hostinger "Setup Python App" → `passenger_wsgi.py` (`application`). Note: the Passenger doc in file says app URL `smartsetupuae.ae/api`; production target is the `api.` subdomain — Phase 48.
- Admin: Hostinger Node.js app, `next start`.
- Customer: CRA `build/` static.
