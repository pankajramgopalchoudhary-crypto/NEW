# SmartSetupUAE Data Storage Audit

Generated for the release bundle on 2026-09-07.

## Supabase live schema check

The live Supabase REST OpenAPI schema exposed 48 table/RPC paths. The following critical columns were confirmed from the live schema:

| Table | Confirmed columns |
|---|---|
| `profiles` | `id`, `email`, `full_name`, `role`, `assigned_manager`, `created_at` |
| `checkout_orders` | `id`, `customer_name`, `customer_email`, `customer_phone`, `freezone`, `package_id`, `package_name`, `duration_years`, `visa_count`, `shareholder_count`, `base_price`, `addons_total`, `discount_total`, `final_total`, `currency`, `status`, `notes`, `created_at`, `order_ref` |
| `checkout_order_addons` | `id`, `order_id`, `addon_name`, `addon_category`, `price`, `currency`, `created_at` |
| `freezone_packages` | `id`, `freezone`, `package_name`, `package_type`, `duration_years`, `visa_count`, `shareholder_count`, `base_price`, `discount_price`, `promotion_price`, `currency`, `is_active`, `notes`, `created_at`, `activities_allowed` |
| `freezone_pricing` | `id`, `freezone`, `is_active`, `no_visa_price`, `one_visa_price`, `more_visa_price`, `investor_visa_cost`, `employee_visa_cost`, `visa_later_cost`, `establishment_card_cost`, `medical_emirates_id_cost`, `renewal_cost`, `notes`, `updated_at` |
| `package_discounts` | `id`, `freezone`, `duration_years`, `discount_percentage`, `applies_to`, `is_active` |
| `coupons` | `code`, `discount_type`, `discount_value`, `usage_limit`, `used_count`, `valid_from`, `valid_until`, `description`, `is_active`, `created_at` |
| `payments` | `id`, `lead_id`, `client_name`, `zone`, `payment_type`, `amount`, `method`, `ref_number`, `status`, `notes`, `created_at` |
| `documents` | `id`, `lead_id`, `ref_id`, `doc_type`, `doc_key`, `file_name`, `file_path`, `status`, `notes`, `reviewed_by`, `reviewed_at`, `submitted_at` |
| `founder_club_memberships` | `id`, `user_id`, `tier_id`, `order_id`, `member_number`, `member_since`, `expires_at`, `status`, `total_saved_aed`, `notes`, `created_at`, `updated_at` |
| `leads` | `id`, `name`, `email`, `phone`, `whatsapp`, `nationality`, `zone`, `biz_type`, `activities`, `company_names`, `booking_type`, `amount_paid`, `full_total`, `pay_method`, `coupon`, `status`, `source`, `notes`, `created_at`, `assigned_manager`, `assigned_staff`, `assigned_reviewer`, `lead_status`, `assignment_notes`, `assigned_at` |
| `activities_master` | `id`, `freezone`, `activity_name`, `activity_code`, `industry_group`, `keywords`, `is_active`, `created_at` |

### Direct confirmation still required

`payment_proofs` and `kyc_documents` were not present as REST OpenAPI schemas. Confirm them in Supabase Table Editor or SQL before production. The source expects at least:

- `payment_proofs`: `id`, `order_id` or `lead_id`, client identity, amount, proof/storage path, status, reviewer, timestamps.
- `kyc_documents`: `id`, `user_email`, `doc_key`, `file_name`, `file_size_bytes`, `uploaded_at`, status/review fields, and storage path/URL.

Also verify RLS policies, foreign keys, storage buckets, and RPC permissions. Column existence alone does not prove that the customer or admin role can access the rows.

## Supabase responsibilities

Supabase stores authentication, customer profiles, package/pricing catalog, checkout order records, order add-ons, coupons, payment records/proofs, documents, founder memberships, activities, leads, and storage objects. Supabase Realtime is used for ticket event notifications where configured.

## MongoDB collections and purpose

Database: `DB_NAME` (normally `smartsetupuae`).

| Collection | Function |
|---|---|
| `order_snapshots` | Immutable server-priced order line items used by fulfilment. |
| `order_fulfilments` | Idempotency and fulfilment result for paid orders; portal account, membership, and email status. |
| `payment_transactions` | Stripe session, amount, currency, payment status, and webhook state. |
| `support_tickets` | Customer support ticket state, assignment, priority, SLA fields. |
| `support_messages` | Customer/admin ticket conversation messages. |
| `counters` | Atomic ticket/reference number sequences. |
| `sla_policies` | Business-hours SLA policy configuration. |
| `sla_events` | SLA response/resolution events. |
| `reminders` | Deduplicated renewal and operational reminders. |
| `ai_support_config` | AI support mode, thresholds, categories, and safety configuration. |
| `ai_support_logs` | AI suggestions, confidence, escalation, and audit history. |
| `aria_memory` | Conversation memory for Aria where enabled. |
| `email_logs` | Outgoing email audit and provider delivery state. |
| `resend_webhook_events` | Resend delivery webhook events. |
| `admin_users` | Next.js admin authentication users. This duplicates Supabase staff roles and should be unified later. |
| `admin_otps`, `admin_sessions`, `admin_audit` | Legacy/FastAPI admin OTP sessions and audit records. |
| `client_profiles_ext` | Extended customer portal profile data. |
| `application_progress` | Client setup/registration progress. |
| `appointments` | Client appointments. |
| `document_vault` | Client private vault entries. |
| `compliance_status` | Client compliance state. |
| `renewals` | License/service renewal records. |
| `invoices` | Generated invoice metadata. |
| `client_assignments` | Staff-to-client assignments. |
| `careers_jobs`, `careers_applications` | Careers content and applications. |
| `referral_codes`, `referrals`, `referral_rewards` | Referral program state and rewards. |
| `jurisdiction_catalog`, `package_catalog`, `addon_catalog`, `package_addon_catalog`, `package_discount_catalog` | Backend catalog cache/seed collections used for server-side pricing. |
| `service_catalog` | Standalone service pricing, including tax, auditing, bookkeeping, and VAT services. |
| `coupon_redemptions` | One-time coupon redemption/idempotency records. |
| `status_checks` | Basic server health/sample status records. |

## Important architecture note

The system currently has competing catalog/order surfaces: Supabase is the intended business source, while the FastAPI backend also maintains Mongo catalog caches and order snapshots. Before launch, seed/sync the Mongo cache and verify that server-side checkout reads the same current prices shown to customers. Never place service-role keys or Mongo credentials in the downloadable frontend or public web folder.
