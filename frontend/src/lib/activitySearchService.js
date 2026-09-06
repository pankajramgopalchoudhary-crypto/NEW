import { captureLead, supabaseRest } from './supabaseRest';
import { loadFreezonePackages } from './pricingService';

const ACTIVITY_COLUMNS = 'id,freezone,activity_name,activity_code,industry_group,keywords,is_active';
const FALLBACK_RECOMMENDATIONS = ['Meydan FZ', 'IFZA Dubai', 'SPC Free Zone'];

// Industry group → preferred freezone slugs (in priority order). Used when we
// don't have an exact activity row but know the broad business type.
const INDUSTRY_PREFERENCE = {
  media: ['shams', 'spc-free-zone', 'twofour54', 'dmcc'],
  publishing: ['spc-free-zone', 'shams', 'dmcc'],
  ecommerce: ['ifza', 'meydan-fz', 'ancfz', 'rakez'],
  trading: ['dmcc', 'ifza', 'meydan-fz', 'rakez'],
  consulting: ['meydan-fz', 'ifza', 'spc-free-zone'],
  technology: ['meydan-fz', 'ifza', 'spc-free-zone', 'dtec'],
  industrial: ['kizad', 'rakez', 'jafza'],
  logistics: ['jafza', 'rakez', 'dafz'],
  healthcare: ['dhcc', 'meydan-fz'],
  finance: ['difc', 'adgm', 'dmcc'],
  education: ['dko', 'dubai-ic'],
};

function escapeLike(value = '') {
  return String(value).trim().replace(/[%,()]/g, ' ');
}

export function normalizeActivity(row = {}) {
  return {
    id: row.id || `${row.freezone || 'uae'}-${row.activity_code || row.activity_name}`,
    freezone: row.freezone || 'Mainland',
    activity_name: row.activity_name || row.name || row.activity || '',
    activity_code: row.activity_code || row.code || '',
    industry_group: row.industry_group || '',
    keywords: row.keywords || '',
    is_active: row.is_active !== false,
  };
}

function escapeRegex(s = '') {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Relevance ranking for activity rows.
 * Postgres `ilike *term*` matches anywhere in name/keywords, which pushed long,
 * loosely-related rows to the top (alphabetical). We re-rank client-side:
 * exact > starts-with > whole-word > substring, plus per-word hits, and we
 * de-duplicate identical activity names across authorities.
 */
export function rankActivities(rows = [], term = '') {
  const t = String(term || '').toLowerCase().trim();
  if (!t) return rows;
  const words = t.split(/\s+/).filter((w) => w.length > 1);

  const scoreOf = (r) => {
    const name = String(r.activity_name || '').toLowerCase();
    const code = String(r.activity_code || '').toLowerCase();
    let s = 0;
    if (name === t) s += 120;
    else if (name.startsWith(t)) s += 80;
    else if (new RegExp(`\\b${escapeRegex(t)}\\b`).test(name)) s += 60;
    else if (name.includes(t)) s += 30;
    if (code === t) s += 130;
    else if (code.startsWith(t)) s += 45;
    const hits = words.filter((w) => new RegExp(`\\b${escapeRegex(w)}`).test(name)).length;
    s += hits * 14;
    if (words.length > 1 && hits === words.length) s += 20;
    if (words.some((w) => String(r.industry_group || '').toLowerCase().includes(w))) s += 6;
    if (words.some((w) => String(r.keywords || '').toLowerCase().includes(w))) s += 3;
    s -= Math.min(12, Math.floor(name.length / 40)); // prefer concise, precise names
    return s;
  };

  const best = new Map();
  rows.forEach((r) => {
    const key = String(r.activity_name || '').toLowerCase();
    const sc = scoreOf(r);
    const cur = best.get(key);
    if (!cur || sc > cur.sc) best.set(key, { r, sc });
  });
  const ranked = [...best.values()].sort((a, b) => b.sc - a.sc);
  const strong = ranked.filter((x) => x.sc > 0);
  return (strong.length ? strong : ranked).map((x) => x.r);
}

export async function searchActivities(term, { freezone, limit = 20 } = {}) {
  const cleaned = escapeLike(term);
  const filters = ['is_active=eq.true'];

  if (freezone && freezone !== 'All') {
    filters.push(`freezone=ilike.*${encodeURIComponent(freezone)}*`);
  }

  if (cleaned) {
    const q = encodeURIComponent(`*${cleaned}*`);
    filters.push(`or=(activity_name.ilike.${q},activity_code.ilike.${q},industry_group.ilike.${q},keywords.ilike.${q})`);
  }

  // Over-fetch so ranking has candidates to choose from, then trim to `limit`.
  const fetchLimit = Math.min(240, Math.max(limit * 6, 60));
  const query = `?select=${ACTIVITY_COLUMNS}&${filters.join('&')}&order=activity_name.asc&limit=${fetchLimit}`;
  const data = await supabaseRest.select('activities_master', query);
  const rows = (data || []).map(normalizeActivity);
  return rankActivities(rows, term).slice(0, limit);
}

function detectIndustry(text = '') {
  const lower = text.toLowerCase();
  if (/media|publish|adverti|broadcast|production/.test(lower)) return 'media';
  if (/e-?commerce|online retail|web ?shop/.test(lower)) return 'ecommerce';
  if (/trad|import|export|wholesale|gold|commodit/.test(lower)) return 'trading';
  if (/consult|advisory|management/.test(lower)) return 'consulting';
  if (/software|it|tech|ai|saas|app|develop|cyber/.test(lower)) return 'technology';
  if (/industr|manufactur|factory|assembly/.test(lower)) return 'industrial';
  if (/logist|warehouse|freight|shipping|cargo/.test(lower)) return 'logistics';
  if (/health|medic|clinic|pharma|hospital/.test(lower)) return 'healthcare';
  if (/financ|invest|bank|fintech|capital/.test(lower)) return 'finance';
  if (/educat|training|school|tuition/.test(lower)) return 'education';
  return null;
}

/**
 * REGULATED-ACTIVITY WHITELIST
 *
 * Some UAE activities can ONLY be licensed by specific regulators/jurisdictions.
 * If a customer searches for a regulated activity, we MUST NOT recommend
 * generic zones like ANCFZ / Meydan / IFZA that are not authorised to
 * license these activities.
 *
 * Sources:
 *   • Crypto / Virtual Assets → VARA (Dubai) or FSRA (ADGM) or DFSA (DIFC).
 *     Only zones with a VARA MoU or their own crypto framework may issue.
 *   • Financial services → DIFC (DFSA) or ADGM (FSRA) only.
 *   • Insurance / re-insurance → DIFC / ADGM only.
 *   • Healthcare (clinical) → DHCC or mainland DHA/MOH only. Free zones
 *     that don't have a health-regulator can't issue clinical licences.
 *   • Broadcast / satellite media → twofour54 / SHAMS / DMCC (Media Cluster).
 */
const REGULATED_ALLOWLIST = {
  crypto: {
    // Test → activity text matches ANY of these terms
    triggers: [
      'crypto', 'virtual asset', 'vara', 'blockchain',
      'nft', 'token', 'digital asset', 'defi', 'web3',
      'crypto exchange', 'digital asset exchange', 'crypto custodian',
      'crypto broker', 'crypto wallet',
      'bitcoin', 'ethereum', 'stablecoin',
    ],
    // Only these free-zone slugs may license crypto/virtual-asset activities.
    allowedSlugs: ['dmcc', 'adgm', 'difc', 'dwtc', 'dmcc-crypto-centre'],
    label: 'Crypto / VARA — restricted to VARA-approved zones',
    note: 'ANCFZ, Meydan, IFZA, RAKEZ, SPC, SHAMS, UAQ and other zones cannot issue crypto/VARA licences.',
  },
  financial: {
    triggers: [
      'bank', 'banking', 'insurance', 'reinsurance',
      'securities', 'asset management', 'fund management',
      'payment services', 'money exchange', 'money service',
      'brokerage', 'investment advisory', 'family office',
      'wealth management', 'islamic finance',
    ],
    allowedSlugs: ['difc', 'adgm'],
    label: 'Regulated financial services — DIFC / ADGM only',
    note: 'Only DIFC (DFSA) and ADGM (FSRA) are UAE onshore financial free zones.',
  },
  healthcare_clinical: {
    triggers: [
      'clinic', 'hospital', 'medical centre', 'medical center',
      'dentist', 'dental clinic', 'physiotherapy', 'radiology',
      'pathology laboratory', 'polyclinic',
    ],
    allowedSlugs: ['dhcc', 'shj-medical'],
    label: 'Clinical healthcare — DHCC / DHA regulated only',
    note: 'Clinical practice requires DHA (mainland) or DHCC licensing.',
  },
  broadcast_media: {
    triggers: [
      'broadcast', 'satellite', 'tv channel', 'radio station',
      'terrestrial television',
    ],
    allowedSlugs: ['twofour54', 'shams', 'dmcc'],
    label: 'Broadcast — Media-Free-Zone regulated only',
    note: 'Broadcasting requires a media authority (twofour54 / SHAMS / DMCC media cluster).',
  },
};

/**
 * Returns the regulated category the activity falls into, or `null`.
 * Text is the concatenation of activity name + keywords + industry group.
 *
 * Evaluation order (defensive): `financial` is checked before `crypto` so
 * ambiguous terms like "money exchange" map to financial, not crypto.
 */
export function detectRegulatedCategory(text = '') {
  const lower = text.toLowerCase();
  const order = ['financial', 'healthcare_clinical', 'broadcast_media', 'crypto'];
  for (const cat of order) {
    const cfg = REGULATED_ALLOWLIST[cat];
    if (cfg && cfg.triggers.some((t) => lower.includes(t))) return cat;
  }
  return null;
}

/**
 * Polished recommendation builder (Phase 7).
 * If `livePackages` is provided, returns up to 3 ranked free-zone cards with
 * live pricing, processing time, visa quota and a "why" reason. Otherwise
 * falls back to the legacy single-zone output.
 *
 * Note: `livePackages` items come from `normalizeFreezonePackage()` and use
 * `freezone_name`, `slug`, `base_price`, `service_fee`, `visa_count`, etc.
 */

// Map freezone slug → typical processing-time string.
const ZONE_PROCESSING = {
  ancfz: '24–72 hrs',
  spc: '3–5 days',
  'spc-free-zone': '3–5 days',
  shams: '3–5 days',
  rakez: '1–2 weeks',
  meydan: '3–5 days',
  'meydan-fz': '3–5 days',
  ifza: '3–5 days',
  dmcc: '2–4 weeks',
  jafza: '2–3 weeks',
  kizad: '2–4 weeks',
  dafza: '2–3 weeks',
};

// Pick the cheapest package per free-zone to use as the "best card" for that zone.
function bestPerFreezone(packages) {
  const byZone = new Map();
  packages.forEach((p) => {
    const key = String(p.slug || p.freezone_name || '').toLowerCase();
    if (!key) return;
    const current = byZone.get(key);
    if (!current || (p.base_price || 0) < (current.base_price || 0)) {
      byZone.set(key, p);
    }
  });
  return [...byZone.values()];
}

export function buildRecommendation(activity, livePackages = []) {
  const row = normalizeActivity(activity);
  const haystack = `${row.activity_name} ${row.keywords} ${row.industry_group}`.toLowerCase();
  const industry = detectIndustry(haystack);
  const preferred = (industry && INDUSTRY_PREFERENCE[industry]) || [];

  // -----------------------------------------------------------------
  // REGULATED-ACTIVITY GUARDRAIL
  // If this activity is Crypto/VARA, regulated finance, clinical healthcare
  // or broadcast, we HARD-FILTER the package list to only the authorised
  // zones. Prevents e.g. ANCFZ being suggested for a crypto activity.
  // -----------------------------------------------------------------
  const regulatedCat = detectRegulatedCategory(haystack);
  const regulatedCfg = regulatedCat ? REGULATED_ALLOWLIST[regulatedCat] : null;
  const allowedSet = regulatedCfg
    ? new Set(regulatedCfg.allowedSlugs.map((s) => s.toLowerCase()))
    : null;

  // Group packages by zone, keep the cheapest per zone as the headline option.
  let oneCardPerZone = bestPerFreezone(livePackages || []);

  // Apply the regulated-activity filter BEFORE scoring.
  if (allowedSet) {
    oneCardPerZone = oneCardPerZone.filter((p) => {
      const slug = String(p.slug || '').toLowerCase();
      const name = String(p.freezone_name || '').toLowerCase();
      // Match by slug OR by freezone name containing an allowed slug
      if (allowedSet.has(slug)) return true;
      for (const s of allowedSet) if (name.includes(s)) return true;
      return false;
    });
  }

  // Score every zone against the activity.
  const scored = oneCardPerZone
    .map((p) => {
      let score = 55;
      const reasons = [];
      const zoneSlug = String(p.slug || '').toLowerCase();
      const zoneName = String(p.freezone_name || '').toLowerCase();

      // If this is a regulated activity, add the compliance reason and give a base boost.
      if (regulatedCfg) {
        score += 20;
        reasons.push(regulatedCfg.label);
      }

      // Exact freezone match (activity is listed under this exact zone).
      if (row.freezone && zoneName.includes(row.freezone.toLowerCase())) {
        score += 28;
        reasons.push('Activity listed under this authority');
      }
      // Industry preference.
      const slugIdx = preferred.indexOf(zoneSlug);
      if (slugIdx === 0) { score += 22; reasons.push(`Top pick for ${industry}`); }
      else if (slugIdx > 0 && slugIdx < 4) { score += 15 - slugIdx * 2; reasons.push(`Recommended for ${industry}`); }

      // Cost-effective boost for cheap zones (only when NOT a regulated activity —
      // regulated zones are always expensive; ranking on price would just be noise).
      const price = p.base_price || p.total_with_service || 0;
      if (!regulatedCfg) {
        if (price > 0 && price < 7000) { score += 10; reasons.push('Most cost-effective'); }
        else if (price > 0 && price < 13000) { score += 4; reasons.push('Cost-effective'); }
      }

      // Visa quota signal.
      if ((p.visa_count || 0) >= 1) { score += 3; }

      const processing = ZONE_PROCESSING[zoneSlug] || '3–5 days';
      if (/24|48|1[ -]?3|2[ -]?5|3[ -]?5/.test(processing)) {
        score += 5; reasons.push('Quick issuance');
      }

      return { p, score, reasons, processing, price };
    })
    .sort((a, b) => b.score - a.score);

  const top3 = scored.slice(0, 3).map((x) => ({
    zone_name: x.p.freezone_name,
    zone_slug: x.p.slug,
    package_name: x.p.package_name,
    package_id: x.p.package_id,
    gov: x.price,
    svc: x.p.service_fee || 0,
    processing_time: x.processing,
    visa_quota: x.p.visa_count || x.p.raw?.visa_count || null,
    activities_allowed: x.p.raw?.activities_allowed || null,
    shareholders: x.p.raw?.shareholder_count || null,
    score: Math.min(99, x.score),
    reasons: x.reasons,
    raw: x.p,
  }));

  // Regulated activity with no live package for an authorised zone → still show
  // the authorised jurisdictions as (unpriced) options so the customer sees the
  // exact right answer instead of a generic zone.
  if (regulatedCfg && top3.length === 0) {
    regulatedCfg.allowedSlugs.slice(0, 3).forEach((s, idx) => {
      top3.push({
        zone_name: s.toUpperCase(),
        zone_slug: s,
        package_name: null,
        package_id: null,
        gov: 0,
        svc: 0,
        processing_time: '2–4 weeks',
        visa_quota: null,
        activities_allowed: null,
        score: 95 - idx * 8,
        reasons: [regulatedCfg.label],
        raw: {},
      });
    });
  }

  const fallbackBest = row.freezone && row.freezone !== 'All' ? row.freezone : 'Meydan FZ';
  const bestZone = top3[0]?.zone_name || (regulatedCfg ? regulatedCfg.allowedSlugs[0].toUpperCase() : fallbackBest);
  const cost = top3[0] ? `AED ${(top3[0].gov || 0).toLocaleString()}` : 'AED 12,500';
  const processingTime = top3[0]?.processing_time || '2–3 weeks';
  const alternatives = top3.length
    ? top3.slice(1).map((t) => t.zone_name)
    : (regulatedCfg
        ? regulatedCfg.allowedSlugs.slice(1).map((s) => s.toUpperCase())
        : FALLBACK_RECOMMENDATIONS.filter((z) => z !== bestZone).slice(0, 2));
  const matchScore = top3[0]?.score || (row.freezone ? 92 : 84);

  return {
    activity: row.activity_name,
    activityCode: row.activity_code,
    industryGroup: row.industry_group || industry || 'General',
    industryDetected: industry,
    bestZone,
    cost,
    processingTime,
    matchScore,
    alternatives,
    options: top3, // ← new: ranked, live-priced cards
    regulated: regulatedCfg ? {
      category: regulatedCat,
      label: regulatedCfg.label,
      note: regulatedCfg.note,
      allowedSlugs: regulatedCfg.allowedSlugs,
    } : null,
    raw: row,
  };
}

const BACKEND_URL = String(process.env.REACT_APP_BACKEND_URL || '').replace(/\/$/, '');

// Resolve a promise but never wait longer than `ms` — fall back gracefully.
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    Promise.resolve(promise).catch(() => fallback),
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// Normalise a zone label to a comparable key (drops "free zone", "fz", punctuation).
function zoneKey(s = '') {
  return String(s)
    .toLowerCase()
    .replace(/free\s*zone/g, '')
    .replace(/\bfz\b/g, '')
    .replace(/\bauthority\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Ask the Gemini-powered backend ranker for the best zones for an activity.
async function fetchSmartRank(activityName, opts = {}) {
  if (!BACKEND_URL || !activityName) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const resp = await fetch(`${BACKEND_URL}/api/aria/smart-rank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        activity: activityName,
        industry: opts.industry || null,
        nationality: opts.nationality || null,
        visas_needed: opts.visas_needed || 1,
        budget_aed: opts.budget_aed || null,
      }),
    });
    clearTimeout(t);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data || !Array.isArray(data.top) || data.top.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

function packageToOption(p, { score, reasons, processing }) {
  const zoneSlug = String(p.slug || '').toLowerCase();
  return {
    zone_name: p.freezone_name,
    zone_slug: p.slug,
    package_name: p.package_name,
    package_id: p.package_id,
    gov: p.base_price || p.total_with_service || 0,
    svc: p.service_fee || 0,
    processing_time: processing || ZONE_PROCESSING[zoneSlug] || '3–5 days',
    visa_quota: p.visa_count || p.raw?.visa_count || null,
    activities_allowed: p.raw?.activities_allowed || p.activities_allowed || null,
    shareholders: p.raw?.shareholder_count || null,
    score,
    reasons,
    raw: p,
  };
}

/**
 * Convenience wrapper used by UI — AI-first ranking with client-rules fallback.
 *  1. Load live packages + build the deterministic client recommendation (also
 *     yields regulated-activity guardrail + activity code + industry).
 *  2. For NON-regulated activities, ask the Gemini ranker (/api/aria/smart-rank)
 *     for the exact best zones and enrich each with the live package (price,
 *     visas, package_id for checkout).
 *  3. Fall back to the client result whenever AI is unavailable or empty.
 */
export async function buildLiveRecommendation(activity, opts = {}) {
  let packages = [];
  try {
    packages = await withTimeout(loadFreezonePackages(), 6000, []);
  } catch {
    packages = [];
  }

  const base = buildRecommendation(activity, packages);

  // Regulated activities keep the hard-filtered client result — AI must never
  // override compliance (e.g. suggesting a non-VARA zone for crypto).
  if (base.regulated) return base;

  const activityName = base.activity || normalizeActivity(activity).activity_name;
  const ai = await withTimeout(fetchSmartRank(activityName, {
    industry: base.industryGroup,
    ...opts,
  }), 10000, null);
  if (!ai) return base;

  const zonePkgs = bestPerFreezone(packages);
  const options = [];
  ai.top.forEach((t, idx) => {
    const aiKey = zoneKey(t.zone);
    if (!aiKey) return;
    const match = zonePkgs.find((p) => {
      const k1 = zoneKey(p.slug);
      const k2 = zoneKey(p.freezone_name);
      return (
        k1 === aiKey || k2 === aiKey ||
        (k1 && (k1.includes(aiKey) || aiKey.includes(k1))) ||
        (k2 && (k2.includes(aiKey) || aiKey.includes(k2)))
      );
    });
    const reasons = t.reason ? [t.reason] : [];
    const score = Math.min(99, Math.max(50, Math.round(t.score || 90 - idx * 12)));
    if (match) {
      options.push(packageToOption(match, { score, reasons, processing: t.speed }));
    } else {
      // AI recommended a zone we don't sell a live package for — still surface it.
      options.push({
        zone_name: t.zone,
        zone_slug: aiKey,
        package_name: t.package || null,
        package_id: null,
        gov: Number(t.price_aed) || 0,
        svc: 0,
        processing_time: t.speed || '2–3 weeks',
        visa_quota: null,
        activities_allowed: null,
        score,
        reasons,
        raw: {},
      });
    }
  });

  if (options.length === 0) return base;

  const best = options[0];
  return {
    ...base,
    bestZone: best.zone_name,
    cost: `AED ${Number(best.gov || 0).toLocaleString()}`,
    processingTime: best.processing_time,
    matchScore: best.score,
    alternatives: options.slice(1).map((o) => o.zone_name),
    options,
    aiSummary: ai.summary || '',
    aiPowered: true,
  };
}

export async function captureAILead(form, recommendation, sourceCta = 'ai_search_start_application') {
  return captureLead({
    source_page: sourceCta,
    name: form.name,
    email: form.email,
    phone_country_code: form.countryCode,
    phone_number: form.phone,
    whatsapp: form.whatsapp || form.phone,
    nationality: form.nationality,
    residence_country: form.residenceCountry,
    business_activity: recommendation?.activity,
    activity_code: recommendation?.activityCode,
    freezone_name: recommendation?.bestZone,
    selected_freezone: recommendation?.bestZone,
    selected_activity: recommendation?.activity,
    industry_group: recommendation?.industryGroup,
    message: `AI Search lead: ${recommendation?.activity || ''} → ${recommendation?.bestZone || ''}`,
    raw_payload: { form, recommendation },
  });
}
