// PREVIEW ONLY — new AI-first hero design (option 2B).
// Route: /preview-hero
// Once approved by user, swap into /app/frontend/src/pages/Home.jsx.
// DOES NOT TOUCH the current home page.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, ChevronDown, ShieldCheck, Zap, Globe2, Clock } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { searchActivities } from '../lib/activitySearchService';
import { loadFreezonePackages } from '../lib/pricingService';

// Zone presentation metadata (sectors, slug, emirate, processing speed, special note).
// Visa range + activities + price are loaded LIVE from Supabase.
const ZONE_META = {
  ifza:        { name: 'IFZA',         emirate: 'Dubai',          sectors: 'General Trading · Services · Consultancy', speed: 'Express',   accent: 'emerald', popular: true,  order: 1, note: 'Flexi-desk · 3 activities per licence' },
  shams:       { name: 'SHAMS',        emirate: 'Sharjah',        sectors: 'Media · Freelancing · Services',           speed: 'Express',   accent: 'amber',   popular: true,  order: 2, note: 'Best for media & creators · multi-year discounts' },
  ancfz:       { name: 'ANCFZ',        emirate: 'Ajman',          sectors: 'Trading · Consultancy · Tech',             speed: '24-72 hrs', accent: 'emerald', popular: true,  order: 3, note: 'Cheapest entry · Pay-As-You-Go option · mix-and-match activities' },
  spc:         { name: 'SPC',          emirate: 'Sharjah',        sectors: 'Publishing · E-Commerce · Trading',        speed: '3-5 days',  accent: 'emerald', popular: true,  order: 4, note: 'Up to 7 shareholders · 5 activity clauses · VAT inclusive' },
  dmcc:        { name: 'DMCC',         emirate: 'Dubai',          sectors: 'Commodities · Crypto · AI · Gaming',       speed: 'Fast',      accent: 'amber',   popular: true,  order: 5, note: 'Niche centres: Nook (Health & Fitness) · AI · Crypto · Gaming' },
  rakez:       { name: 'RAKEZ',        emirate: 'Ras Al Khaimah', sectors: 'General Trading · Industrial · SME',       speed: 'Fast',      accent: 'emerald', popular: true,  order: 6, note: 'Up to 5 shareholders + coworking · SME-friendly' },
  meydan:      { name: 'Meydan FZ',    emirate: 'Dubai',          sectors: 'Tech · Consulting · Trading',              speed: '3-5 days',  accent: 'amber',   popular: false, order: 7, note: 'Dubai address · digital-first setup' },
  'meydan-fz': { name: 'Meydan FZ',    emirate: 'Dubai',          sectors: 'Tech · Consulting · Trading',              speed: '3-5 days',  accent: 'amber',   popular: false, order: 7, note: 'Dubai address · digital-first setup' },
  dafza:       { name: 'DAFZA',        emirate: 'Dubai',          sectors: 'Aviation · Logistics · Trading',           speed: '2-3 weeks', accent: 'amber',   popular: false, order: 8, note: 'Premium airport-adjacent zone · enterprise-grade' },
};

function slugifyFz(raw) {
  return String(raw || '').toLowerCase().trim().replace(/\s+/g, '-');
}

export default function HeroPreview() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [nationality, setNationality] = useState('');
  const [visas, setVisas] = useState('1');
  const [budget, setBudget] = useState('');
  const [popularZones, setPopularZones] = useState([]);
  const [pricesLoading, setPricesLoading] = useState(true);
  const inputRef = useRef(null);

  // Load live prices from Supabase — cheapest active package per freezone +
  // also compute the visa range across all that zone's active packages.
  useEffect(() => {
    loadFreezonePackages()
      .then((packages) => {
        const groups = new Map();
        (packages || []).forEach((p) => {
          const key = slugifyFz(p.slug || p.freezone_name);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(p);
        });

        const enriched = [];
        groups.forEach((pkgs, key) => {
          const meta = ZONE_META[key];
          if (!meta) return;
          const cheapest = pkgs.reduce((min, p) => ((p.base_price || 0) < (min.base_price || 0) ? p : min), pkgs[0]);
          const visaCounts = pkgs.map((p) => p.visa_count || 0);
          const maxVisas = Math.max(...visaCounts);
          const maxActivities = Math.max(...pkgs.map((p) => p.activities_allowed || 3));
          enriched.push({
            slug: key,
            name: meta.name,
            emirate: meta.emirate,
            sectors: meta.sectors,
            speed: meta.speed,
            accent: meta.accent,
            popular: meta.popular,
            order: meta.order,
            note: meta.note,
            price: cheapest.base_price,
            packageName: cheapest.package_name,
            packageVisas: cheapest.visa_count || 0,
            durationYears: cheapest.duration_years || 1,
            maxVisas,
            maxActivities,
            packageCount: pkgs.length,
          });
        });
        enriched.sort((a, b) => a.order - b.order);
        setPopularZones(enriched);
      })
      .catch(() => setPopularZones([]))
      .finally(() => setPricesLoading(false));
  }, []);

  useEffect(() => {
    if (!q || q.length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
        const rows = await searchActivities(q, { limit: 6 });
        setSuggestions(rows);
      } catch (err) {
        console.warn('[hero-preview] searchActivities failed', err);
        setSuggestions([]);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const submit = (activity) => {
    const params = new URLSearchParams({ q: activity || q });
    if (nationality) params.set('nat', nationality);
    if (visas) params.set('visas', visas);
    if (budget) params.set('budget', budget);
    navigate(`/ai-search?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-[#FFFCF5]">
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden pt-10 pb-16 lg:pt-16 lg:pb-20">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none opacity-60">
          <div className="absolute -top-20 -right-32 w-[700px] h-[700px] rounded-full bg-emerald-200/30 blur-3xl" />
          <div className="absolute top-40 -left-20 w-[500px] h-[500px] rounded-full bg-amber-200/25 blur-3xl" />
        </div>

        <div className="relative max-w-[1480px] mx-auto px-5 lg:px-8">
          {/* Eyebrow */}
          <div className="flex justify-center mb-5 fade-up">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-700/8 border border-emerald-700/15 text-emerald-800 text-[11.5px] font-bold uppercase tracking-[0.18em]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Powered by Official UAE Government Data + AI
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-center font-display font-bold tracking-tight text-slate-900 fade-up" style={{ fontSize: 'clamp(2.4rem, 6vw, 4.5rem)', lineHeight: 1.05 }}>
            Compare <span className="brand-emerald">40+ UAE Free Zones</span><br />
            & Find Your <span className="brand-bronze italic">Best Match</span>.
          </h1>

          {/* Subtitle */}
          <p className="text-center text-slate-600 text-base lg:text-lg max-w-2xl mx-auto mt-5 fade-up" style={{ animationDelay: '80ms' }}>
            Launch a startup or scale your company — our AI compares every jurisdiction on
            <b className="text-slate-800"> cost · speed · visas · activities</b> to find your perfect match in 2 minutes.
          </p>

          {/* SEARCH BAR */}
          <div className="mt-8 lg:mt-10 max-w-2xl mx-auto fade-up" style={{ animationDelay: '160ms' }} data-testid="hero-search-wrapper">
            <div className="relative">
              <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                <Sparkles className="h-6 w-6 text-emerald-700" />
              </div>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && q && submit()}
                placeholder="Type your business — Gold Trading, Software, E-Commerce…"
                className="w-full h-16 lg:h-[72px] pl-16 pr-40 text-base lg:text-lg rounded-2xl bg-white border-2 border-emerald-700/15 shadow-xl shadow-emerald-900/10 focus:outline-none focus:border-emerald-700 transition-colors placeholder:text-slate-400"
                data-testid="hero-search-input"
              />
              <button
                onClick={() => q && submit()}
                disabled={!q}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 px-6 h-12 lg:h-14 rounded-xl bg-emerald-700 text-white font-semibold disabled:opacity-50 hover:bg-emerald-800 transition-colors text-sm lg:text-base"
                data-testid="hero-search-submit"
              >
                Find My Match <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                {suggestions.map((s) => (
                  <button
                    key={s.activity_code || s.activity_name}
                    onClick={() => { setQ(s.activity_name); submit(s.activity_name); }}
                    className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors border-b border-slate-100 last:border-b-0 flex items-center gap-3"
                  >
                    <div className="h-7 w-7 rounded-lg bg-emerald-50 grid place-items-center brand-emerald flex-shrink-0">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{s.activity_name}</div>
                      <div className="text-[11px] text-slate-500 truncate">{s.activity_code} · {s.freezone} · {s.industry_group}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Try chips + advanced toggle */}
            <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mr-1">Try:</span>
                {['Software Development', 'Gold Trading', 'E-Commerce', 'Restaurant', 'Consultancy'].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setQ(s); setTimeout(() => submit(s), 100); }}
                    className="text-[11.5px] px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-emerald-700 hover:brand-emerald transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setAdvancedOpen((o) => !o)}
                className="text-[12px] font-semibold brand-emerald inline-flex items-center gap-1 hover:underline"
                data-testid="hero-advanced-toggle"
              >
                {advancedOpen ? 'Hide' : 'Advanced filters'} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* Advanced filters drawer */}
            {advancedOpen && (
              <div className="mt-3 rounded-2xl bg-white border border-slate-200 p-4 lg:p-5 grid grid-cols-1 sm:grid-cols-3 gap-3 fade-up" data-testid="hero-advanced-panel">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Nationality</label>
                  <input value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="e.g., Indian" className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-700" />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold"># of visas</label>
                  <select value={visas} onChange={(e) => setVisas(e.target.value)} className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-700 bg-white">
                    <option value="0">0 (licence only)</option><option value="1">1 visa</option><option value="2">2 visas</option><option value="3">3 visas</option><option value="5">5 visas</option><option value="10">10+ visas</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Budget (AED)</label>
                  <select value={budget} onChange={(e) => setBudget(e.target.value)} className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-700 bg-white">
                    <option value="">Any budget</option><option value="5000">Under AED 5,000</option><option value="10000">Under AED 10,000</option><option value="20000">Under AED 20,000</option><option value="50000">Under AED 50,000</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Trust strip */}
          <div className="mt-7 flex items-center justify-center flex-wrap gap-x-6 gap-y-2 text-[12px] text-slate-600 fade-up" style={{ animationDelay: '240ms' }}>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Free to use</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> No sign-up required</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Results in 30 seconds</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-700" /> Axiscrest-Global FZE LLC</span>
          </div>

          {/* Stats */}
          <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 max-w-4xl mx-auto fade-up" style={{ animationDelay: '320ms' }}>
            <Stat icon={<Globe2 className="h-5 w-5" />} value="40+" label="Jurisdictions" />
            <Stat icon={<Sparkles className="h-5 w-5" />} value="12,719" label="Activities Indexed" />
            <Stat icon={<Zap className="h-5 w-5" />} value="AED 4,888" label="Starting Price" />
            <Stat icon={<Clock className="h-5 w-5" />} value="30 sec" label="To Results" />
          </div>
        </div>
      </section>

      {/* POPULAR ZONES STRIP */}
      <section className="py-14 lg:py-20 bg-white border-y border-slate-200/70">
        <div className="max-w-[1480px] mx-auto px-5 lg:px-8">
          <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-700 font-bold">Popular Jurisdictions</div>
              <h2 className="font-display text-2xl lg:text-4xl font-bold tracking-tight text-slate-900 mt-1">Most requested by entrepreneurs</h2>
            </div>
            <Link to="/free-zones" className="text-[13px] font-semibold brand-emerald hover:underline inline-flex items-center gap-1">View all 40+ jurisdictions <ArrowRight className="h-4 w-4" /></Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pricesLoading && (
              [...Array(6)].map((_, i) => (
                <div key={`placeholder-${i}`} className="rounded-2xl bg-white border border-slate-200 p-5 animate-pulse">
                  <div className="h-5 w-20 bg-slate-200 rounded mb-2" />
                  <div className="h-3 w-12 bg-slate-100 rounded mb-4" />
                  <div className="h-3 w-full bg-slate-100 rounded mb-1" />
                  <div className="h-3 w-3/4 bg-slate-100 rounded mb-4" />
                  <div className="h-8 w-24 bg-slate-200 rounded" />
                </div>
              ))
            )}
            {!pricesLoading && popularZones.length === 0 && (
              <div className="col-span-full text-center text-slate-500 py-8">Pricing data unavailable right now. Please refresh.</div>
            )}
            {popularZones.map((z) => (
              <Link
                key={z.slug}
                to={`/free-zones/${z.slug}`}
                className="group block rounded-2xl bg-gradient-to-br from-white to-slate-50 border border-slate-200 hover:border-emerald-700/40 hover:shadow-2xl transition-all p-5"
                data-testid={`hero-popular-${z.slug}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-display text-xl font-bold text-slate-900 flex items-center gap-1.5">
                      {z.name}
                      {z.popular && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-700 text-white">Popular</span>}
                    </div>
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mt-0.5">{z.emirate}</div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${z.accent === 'emerald' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{z.speed}</span>
                </div>

                <div className="mt-3 text-[12.5px] text-slate-600 line-clamp-2">{z.sectors}</div>

                {/* Special note (Nook = Health & Fitness, ANCFZ mix-match, etc.) */}
                {z.note && (
                  <div className="mt-2 text-[11px] text-emerald-900 bg-emerald-50/70 border border-emerald-700/15 rounded-lg px-2.5 py-1.5 leading-snug">
                    💡 {z.note}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-slate-200/70">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">License from</div>
                      <div className="font-display text-2xl font-bold text-slate-900">AED {Number(z.price || 0).toLocaleString()}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">&ldquo;{z.packageName}&rdquo; · {z.packageVisas === 0 ? 'no visa' : `${z.packageVisas} visa${z.packageVisas > 1 ? 's' : ''}`} · {z.durationYears} yr</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 rounded-lg py-1.5">
                      <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold leading-none">Visas (max)</div>
                      <div className="font-display text-base font-bold brand-emerald mt-1">{z.maxVisas || 0}</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg py-1.5">
                      <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold leading-none">Activities</div>
                      <div className="font-display text-base font-bold brand-emerald mt-1">{z.maxActivities || 3}</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg py-1.5">
                      <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold leading-none">Packages</div>
                      <div className="font-display text-base font-bold brand-emerald mt-1">{z.packageCount}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-[12px] brand-emerald font-semibold inline-flex items-center gap-1 group-hover:gap-2 transition-all">View details <ArrowRight className="h-3.5 w-3.5" /></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PREVIEW BADGE */}
      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-bold uppercase tracking-wider px-4 py-2 rounded-full shadow-xl flex items-center gap-2">
        🎬 PREVIEW MODE — this is the proposed new hero. Approve to replace home page.
        <Link to="/" className="ml-2 underline hover:no-underline">Go back ←</Link>
      </div>

      <Footer />
    </div>
  );
}

function Stat({ icon, value, label }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4 lg:p-5 text-center hover:border-emerald-700/30 hover:shadow-lg transition-all">
      <div className="inline-grid place-items-center h-10 w-10 rounded-xl bg-emerald-50 brand-emerald mb-2 mx-auto">{icon}</div>
      <div className="font-display text-xl lg:text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mt-0.5">{label}</div>
    </div>
  );
}
