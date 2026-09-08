# Admin Portal Limit Audit
 
Date: 2026-09-07

## Validation performed

- `npm run build` in `admin/`: **PASS**
- Next.js production server started on local port 3100: **PASS**
- `GET /api/health`: **200**
- Unauthenticated `GET /api/admin/stats/overview`: **401**
- Empty admin login request: **400** with input validation
- `/admin/login` production page: **200**
- Untrusted-origin `OPTIONS /api/health`: **200**, but response headers are unsafe; see findings below.
- Static diagnostics for the admin tree: no errors reported.

Build warning: Next inferred `/app` as the workspace root because both `/app/yarn.lock` and `admin/yarn.lock` exist. Remove the duplicate lockfile or configure `outputFileTracingRoot` before production deployment.

## Findings ordered by severity

### Critical

1. **Default credentials are seeded automatically.** `admin/lib/auth.js` creates fixed manager, staff, and reviewer credentials when `admin_users` is empty. The deployment guide also publishes those credentials. Remove fixed credentials, require first-run founder setup, and implement/verify any disable-seeding flag before launch.

2. **Staff can patch any order with arbitrary fields.** `admin/app/api/[[...path]]/route.js` allows `founder`, `manager`, and `staff` to send the complete request body into `checkout_orders`. A staff token can therefore change status, totals, customer identity, discounts, or payment-related fields. Replace with an allowlist and role-specific transitions; financial totals must never be editable from this endpoint.

3. **Credentialed CORS and framing are unsafe.** `admin/next.config.js` emits `X-Frame-Options: ALLOWALL` and `frame-ancestors *`. The API emits `Access-Control-Allow-Credentials: true` with a configured origin value that is not validated against the request origin. Live smoke test confirmed a 200 preflight for an untrusted origin. Use an explicit allowlist, echo only a matched origin, and set `DENY`/`frame-ancestors 'none'` unless embedding is explicitly required.

### High

4. **API authorization is broader than page permissions.** Many GET handlers use `requireRole(request)` without role restrictions. Hidden navigation does not protect direct URLs. Staff/reviewer sessions can request data such as orders, payments, clients, leads, pricing, settings, coupons, and support data. Add endpoint-level role policies, not only UI gating.

5. **Managers can mutate users outside their assigned scope.** Staff list GET scopes managers, but PATCH and reset-PIN handlers accept any user ID. Enforce the same manager ownership check for every read and mutation, and prevent manager role escalation or edits to founder/manager accounts.

6. **Payment and document mutations accept arbitrary fields.** Payment PATCH spreads the request body into Supabase; document PATCH spreads the request body into the document row. Use explicit schemas: payment review fields only, and document status/reason fields only. Never accept ownership, storage path, amount, or audit fields from the browser.

7. **Attachment download paths are not bound to the ticket.** The sign-download handler signs any path supplied by an authenticated admin. Verify that the path belongs to the requested ticket before signing.

8. **Public ticket creation has no effective rate limit or payload limit.** It accepts name/email/message and writes a ticket without visible throttling, CAPTCHA, length limits, or strict email validation. This can be abused for Mongo growth and notification spam.

9. **Email Health test action is not wired to the visible API.** `admin/app/admin/email-health/page.js` calls `/api/notify/email/test`, but the catch-all route does not implement that endpoint. The page's `careers` alias is also not present in the configured aliases. Email log field names must be reconciled with the FastAPI writer before trusting stats.

10. **Invoice amount uses obsolete order fields.** The invoice handler reads `total_amount` and `booking_type`, while the current order contract uses `final_total`, `status`, and `freezone`. Invoices can display AED 0 or the wrong booking type.

11. **Pricing activation is broken.** The pricing page sends `PATCH /api/admin/packages/:id` when activating a package, but the route only implements DELETE for that path. Deactivation is supported; reactivation returns 404.

12. **Pricing mutations do not reject invalid numbers.** Bulk Supabase pricing and visa-cost updates call `Number(...)` without rejecting negative, non-finite, or invalid values. This can publish invalid prices.

### Medium

13. Password changes do not enforce strong non-empty passwords or server-side confirmation.

14. Staff creation permits missing usable credentials because password/PIN requirements are not enforced server-side.

15. Ticket priority/category/status values are not constrained to the supported enum values.

16. Ticket search constructs Mongo regular expressions from user input without escaping; this can cause expensive queries.

17. Email templates interpolate user-controlled values directly into HTML without escaping.

18. Login errors distinguish missing users from wrong passwords, enabling account enumeration.

19. Error responses can expose raw exception/provider messages from the catch-all route.

20. Generated invoice object URLs are not revoked in the browser.

## Admin function coverage

The build contains pages for dashboard, analytics, leads/orders, tickets, clients, documents, invoices, payments, pricing, packages, coupons, Founders Club, services, catalog, jurisdictions, legal, SEO, staff, settings, AI support, support analytics, email health, and login.

The main API catch-all contains handlers for authentication, dashboard stats, leads, orders, clients, documents, payments, invoices, pricing, freezone packages, coupons, Founders Club, catalog, services, staff, settings, legal, SEO, tickets, AI support, email logs, and Aria.

Presence is not equivalent to safe operation: the findings above affect authorization, mutation integrity, storage access, email testing, invoice accuracy, and package activation.

## Launch gate

Do not give the admin a production sign-off until Critical and High findings are fixed and retested with separate founder, manager, staff, and reviewer accounts. The minimum regression matrix must cover:

- each role accessing every visible and hidden endpoint
- order status/amount/customer mutation attempts
- payment status and amount mutation attempts
- document ownership/storage mutation attempts
- attachment path traversal/cross-ticket download attempts
- invalid prices and invalid ticket status/priority values
- login brute-force/rate-limit behavior
- email test and delivery-log reconciliation
- invoice totals from a paid order and a prebooking order
- package deactivate/reactivate
- CORS from approved and unapproved origins
