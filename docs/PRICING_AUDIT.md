# Pricing Audit (Phase 1 inventory — to be completed in Phase 21/43)

Canonical source (target): Supabase `freezone_packages` (packages), `freezone_pricing` (per-zone government/visa costs), `package_discounts`, `coupons`, plus a new canonical **services** catalog for standalone services.

| ITEM | LOCATION | CURRENT PRICE | REQUIRED PRICE | STATUS | ACTION TAKEN |
|---|---|---|---|---|---|
| Freezone packages (static copy) | `frontend/src/data/freezonePackages.js` (81 literals) | various | DB (`freezone_packages`) | MISMATCH (competing source) | Phase 21: make DB authoritative, static only as offline fallback or remove |
| Zone summaries | `frontend/src/data/zones.js` (26 literals) | various | DB | MISMATCH | Phase 21 |
| Homepage/mock content | `frontend/src/mock.js` (6) | various | DB | MISMATCH | Phase 21 |
| Checkout constants (prebooking, service fee) | `frontend/src/pages/Checkout.jsx`, `lib/checkoutSupabase.js` (`getPrebookingAmount`, `getDefaultServiceFee`) | hardcoded | DB/config | MISMATCH | Phase 25 |
| Cost calculator | `frontend/src/pages/CostCalculator.jsx` (2) | hardcoded | DB | MISMATCH | Phase 21 |
| Investor visa per zone | Supabase `freezone_pricing` | IFZA 5,750; DMCC/DAFZA/Meydan 5,912 placeholder | owner-provided | WARNING | MANUAL ACTION REQUIRED (owner enters real values) |
| Corporate Tax Registration | `ServicePage.jsx` text "AED 1,200 – 5,000 / From AED 1,200" | text only | **Starting AED 1,000, one-time** | MISMATCH + MISSING (no catalog entry) | Phase 22 |
| Corporate Tax Filing | not present | — | **Starting AED 1,000**, billing wording configurable | MISSING | Phase 22 |
| Auditing | `ServicePage.jsx` "AED 1,500 – 6,000 / From AED 1,500" | text only | **Starting AED 1,500/month**, scope-dependent | MISMATCH + MISSING | Phase 22 |
| Bookkeeping | `ServicePage.jsx` "AED 1,000 – 2,500 / month" | text only | **Starting AED 1,200/month**, scope-dependent | MISMATCH + MISSING | Phase 22 |
| VAT registration | `ServicePage.jsx` "AED 1,500 – 3,000" | text only | keep (not in required list) | WARNING | connect to catalog Phase 23 |
| Visa services | `ServicePage.jsx` ranges | text only | catalog | WARNING | Phase 23 |
| Referral cashback | `backend/referral.py` env defaults | AED 50 / 5% | env-configurable | MATCH | none |
