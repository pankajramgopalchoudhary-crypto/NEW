# Hostinger Node-only Compatibility

## Current result

This repository is **not currently deployable as a complete Node-only app**.
The public customer frontend calls the FastAPI backend at
`REACT_APP_BACKEND_URL`. The Next.js application contains the admin UI and a
partial admin API, but it does not implement the complete customer API.

Changing the URL to the admin domain would make the site load while breaking
customer workflows at runtime.

## Required Node-only target

To run everything on Hostinger's supported Node.js platform, the backend must
be migrated to the existing Next.js application or another supported Node
framework. The migration must preserve these endpoint groups:

- Authentication: signup and customer session handling
- Catalog: jurisdictions, packages, services, and live pricing
- Orders: server-side repricing, immutable snapshots, founder discounts, and coupons
- Payments: currencies, Stripe checkout sessions, status polling, and webhooks
- Fulfilment: portal account creation, Founder Club membership, and emails
- Lifecycle: progress, profile, appointments, vault, compliance, renewals, invoices, and leads
- Support: tickets, messages, assignments, attachments, SLA, and AI escalation
- AI: Aria chat, lead capture, and activity ranking
- Documents: OCR and passport-photo processing
- Referral, careers, guides, notifications, and admin operations

The Node implementation must keep MongoDB, Supabase service-role, Stripe,
Resend, and Gemini values server-only. Never expose these through
`NEXT_PUBLIC_*` or the static CRA build.

## Deployment that works today

Until that migration is complete:

| Component | Runtime | Host |
|---|---|---|
| Customer frontend | Static React build | Hostinger `smartsetupuae.ae` |
| Admin panel | Node.js 20/22/24 Next.js app | Hostinger `admin.smartsetupuae.ae` |
| Customer API | Python 3.10/3.11 FastAPI + Passenger, or another Python host | `api.smartsetupuae.ae` |

The Node admin build alone is not proof of a complete Hostinger-only deployment.
The customer API route groups listed below must be implemented in Node and pass
the acceptance gate before the Python service can be removed.

Build the customer frontend with:

```env
REACT_APP_BACKEND_URL=https://api.smartsetupuae.ae
REACT_APP_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
REACT_APP_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

## Node-only acceptance gate

The migration is complete only when all customer frontend calls pass against
the Node API in staging:

1. Auth signup and login
2. Catalog and every freezone duration tab
3. Order creation with server-side price validation
4. Stripe checkout and webhook idempotency
5. Fulfilment and welcome email
6. Client lifecycle and KYC document flow
7. Support tickets, replies, attachments, SLA, and escalation
8. Aria chat and lead capture
9. OCR and passport-photo endpoints
10. Referral, careers, guides, and notifications

Until all ten groups pass, the Python API remains a required production
dependency.