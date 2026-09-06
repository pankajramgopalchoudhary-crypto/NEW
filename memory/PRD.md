# SmartSetupUAE — PRD / Working Memory

## Session 3 (June 2026) — Production Audit master task
Problem statement: 50-phase production audit/fix/integration (keep FastAPI + Mongo + Supabase; admin Next.js → api.smartsetupuae.ae; no rebuild).
- Phase 0+1 DONE: repo cloned into /app/{backend,frontend,admin}; deps installed; backend boots (`/api/` 200).
  Docs: /app/docs/{PRODUCTION_AUDIT,ARCHITECTURE,ENVIRONMENT,PRICING_AUDIT,API_MAP,TEST_PLAN,DEPLOYMENT}.md
- Key findings B1–B21 in PRODUCTION_AUDIT.md (internal-note leak, leaked keys in admin/DEPLOY_README.md,
  browser-side order creation, 3 admin auth systems, admin uses own Next.js API backend, CORS `*`, no password reset/OTP,
  hardcoded prices, accounting services missing from catalog, recommendations not exactly 3).
- BLOCKED on user secrets: SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, GEMINI_API_KEY, (Mongo Atlas URI optional).
- Next: Phase 2–5 (domains/env/secrets/CORS) once keys arrive, then sequential phases.


**Product**: UAE business-setup platform. React customer portal + FastAPI backend + Next.js admin.
Data: Supabase (auth, Postgres, storage `cilents-documents`) + MongoDB (`smartsetupuae`).

## Original problem statement (session 1)
1. Support Analytics (resolution time, SLA %, AI resolution + escalation over 7/30/90d) — DONE
2. Attachments on tickets (customer + admin, MIME/size validation, signed URLs) — DONE
3. AI suggested-reply button in admin ticket workspace — DONE
4. Renewal reminders 30/14/3 days before licence expiry via SLA cron — DONE (blocked: no `licenses` table)
5. Recommendation engine showing the exact right freezone/mainland licence — DONE
6. Checkout page aligned with admin + customer pages — DONE

## Session 2 (June 2026) — delivered
- **Recommendation relevance**: `rankActivities()` in `frontend/src/lib/activitySearchService.js`
  (exact > starts-with > whole-word > substring, de-dupe). "VARA" no longer returns unrelated rows.
- **Start Application fixed**: passes `freezone=<slug>` + `package=<uuid>` to checkout; lead-save
  failure is non-blocking. Verified Gold Trading → DMCC Nook AED 10,345 pre-selected.
- **Checkout ↔ admin ↔ dashboard alignment**: orders persist `order_ref`; readers use
  `final_total`/`freezone`/`package_name`/`order_ref`; admin revenue/clients use `final_total`.
- **Attachment previews**: image thumbnails (signed URL) + size badges both portals; admin
  sign-upload validates MIME + 10 MB; bucket = `cilents-documents`.
- **Auto-Reply Mode**: gated AUTO_REPLY (category + priority allow-lists, confidence ≥ 0.8,
  not requires_human, optional auto-resolve). Admin UI card on Support Analytics. Default: Suggest only.
- **Per-zone investor visa price**: seeded Supabase `freezone_pricing`; `getVisaPrice(zone)` live
  (IFZA 5,750). New **Admin → Pricing → Per-Zone Government Costs** editor.
- Bug fix: `/api/support/tickets/by-user/{email}` missing return.
- Tests: `/app/test_reports/iteration_1.json` (backend 8/8 + frontend flows + mobile).

## In progress — Python → Node migration (user decision: port FastAPI into the Next.js app)
Phase 1 modules written: `admin/lib/support/{customerAuth,gemini,aiSupport,supportEmail}.js`.
Remaining Phase 1 + Phases 2-4 detailed in **/app/HANDOFF.md** (read that first).

## Backlog
- **P0** DMCC / DAFZA / Meydan investor-visa costs need real values (seeded with 5,912 placeholder).
- **P0** Finish Phase 1 migration (tickets, Aria, SLA/cron routes + vercel.json cron).
- **P1** Point renewal scan at a real licence table (`RENEWAL_SOURCE_TABLE`), or create `licenses`.
- **P1** Admin "Generate AI reply" must repoint to the ported endpoint after migration.
- **P2** Phases 2-4 (lifecycle, referrals, careers, Stripe, notifications, OCR/photo) then delete `/app/backend`.
- **P2** Unify ticket storage: admin `tickets` vs backend `support_tickets` dual-source.
