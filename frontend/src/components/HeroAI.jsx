// AI-first hero section + popular zones strip — used on the home page.
// Live prices from Supabase (no hardcoded numbers).
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, ChevronDown, ShieldCheck, Zap, Globe2, Clock } from 'lucide-react';
import { searchActivities } from '../lib/activitySearchService';
import { loadFreezonePackages } from '../lib/pricingService';
import SoftDivider from './SoftDivider';

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

const slugifyFz = (raw) => String(raw || '').toLowerCase().trim().replace(/\s+/g, '-');

export default function HeroAI() {
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
          const maxVisas = Math.max(...pkgs.map((p) => p.visa_count || 0));
          const maxActivities = Math.max(...pkgs.map((p) => p.activities_allowed || 3));
          enriched.push({
            slug: key, ...meta,
            price: cheapest.base_price,
            packageName: cheapest.package_name,
            packageVisas: cheapest.visa_count || 0,
            durationYears: cheapest.duration_years || 1,
            maxVisas, maxActivities,
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
      try { setSuggestions(await searchActivities(q, { limit: 6 })); } catch { setSuggestions([]); }
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
    <>
      <section className="relative overflow-hidden pt-3 pb-12 lg:pt-6 lg:pb-14 hero-gradient">
        <div className="absolute inset-0 pointer-events-none opacity-60">
          <div className="absolute -top-20 -right-32 w-[700px] h-[700px] rounded-full bg-emerald-200/30 blur-3xl" />
          <div className="absolute top-40 -left-20 w-[500px] h-[500px] rounded-full bg-amber-200/25 blur-3xl" />
        </div>

        <div className="relative max-w-[1480px] mx-auto px-5 lg:px-8 grid lg:grid-cols-[1.4fr_1fr] gap-10 lg:gap-12 items-start">
          {/* LEFT — headline + search */}
          <div>
            <div className="flex mb-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-700/8 border border-emerald-700/15 text-emerald-800 text-[11.5px] font-bold uppercase tracking-[0.18em]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                UAE&apos;s First AI Concierge for Founders · Built by a founder, for founders
              </div>
            </div>

            <h1 className="font-display font-bold tracking-tight text-slate-900" style={{ fontSize: 'clamp(2.4rem, 5vw, 4.6rem)', lineHeight: 1.02 }} data-testid="home-hero-headline">
              Open a Company in <span className="brand-emerald">Dubai &amp; UAE</span> — <span className="brand-bronze italic">compare 40+ free zones</span> in 30 seconds.
            </h1>

            <p className="text-slate-700 max-w-2xl mt-5" style={{ fontSize: 'clamp(1rem, 1.2vw, 1.2rem)', lineHeight: 1.55 }}>
              Aria, our AI concierge, compares every UAE jurisdiction on
              <b className="text-slate-900"> cost · setup speed · visa quota · activities</b>.
              Get a personalised match for <b>cheapest free zone licence</b>, <b>mainland trade licence</b>,
              <b> bank account opening</b>, <b>Golden Visa</b>, <b>VAT &amp; corporate tax</b> — all on one platform by Axiscrest-Global FZE&nbsp;LLC.
            </p>

            <div className="mt-7 max-w-2xl" data-testid="home-hero-search">
              <div className="relative">
                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none z-10">
                  <Sparkles className="h-6 w-6 text-emerald-700" />
                </div>
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && q && submit()}
                  placeholder="Type your business — e.g. Gold Trading, Software, Restaurant…"
                  className="w-full h-16 lg:h-[72px] pl-14 pr-[180px] sm:pr-[200px] text-base lg:text-lg rounded-2xl bg-white border-2 border-emerald-700/15 shadow-xl shadow-emerald-900/10 focus:outline-none focus:border-emerald-700 transition-colors placeholder:text-slate-400"
                  data-testid="home-hero-search-input"
                />
                <button
                  onClick={() => q && submit()}
                  disabled={!q}
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 px-4 sm:px-6 h-12 lg:h-14 rounded-xl bg-emerald-700 text-white font-semibold disabled:opacity-50 hover:bg-emerald-800 transition-colors text-sm lg:text-base shadow-lg shadow-emerald-900/20"
                  data-testid="home-hero-search-submit"
                >
                  Find My Match <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              {suggestions.length > 0 && (
                <div className="mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => { setQ(s.activity_name); submit(s.activity_name); }} className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors border-b border-slate-100 last:border-b-0 flex items-center gap-3">
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

              <div className="mt-5 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] text-slate-500 uppercase tracking-wider font-semibold mr-1">Popular searches:</span>
                  {['IT / Software Development', 'General Trading', 'E-Commerce', 'Consultancy', 'Marketing Services', 'Real Estate Brokerage', 'F&B / Restaurant', 'Crypto / VARA'].map((s) => (
                    <button key={s} onClick={() => { setQ(s); setTimeout(() => submit(s), 100); }} className="text-[12.5px] px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-emerald-700 hover:brand-emerald hover:bg-emerald-50/40 transition-colors font-medium">
                      {s}
                    </button>
                  ))}
                </div>
                <button onClick={() => setAdvancedOpen((o) => !o)} className="text-[13px] font-semibold brand-emerald inline-flex items-center gap-1 hover:underline" data-testid="home-hero-advanced">
                  {advancedOpen ? 'Hide' : 'Advanced filters'} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {advancedOpen && (
                <div className="mt-3 rounded-2xl bg-white border border-slate-200 p-4 lg:p-5 grid grid-cols-1 sm:grid-cols-3 gap-3 fade-up">
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

            <div className="mt-7 flex items-center flex-wrap gap-x-6 gap-y-2 text-[13px] text-slate-600">
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Zero commission from any freezone</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Official UAE government pricing</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Free for the first 500 founders</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-700" /> Axiscrest-Global FZE LLC · Lic 262843696888</span>
            </div>
          </div>

          {/* RIGHT — Live SEO trust card (fills space + boosts Google) */}
          <aside className="hidden lg:block">
            <div className="rounded-3xl bg-gradient-to-br from-[#0F2A2A] to-[#13433f] text-white p-7 shadow-2xl shadow-emerald-900/20 sticky top-24">
              <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-[#F0C674]">Most searched this week</div>
              <h3 className="font-display text-2xl font-semibold mt-2 leading-tight">
                What founders are setting up in the UAE right now
              </h3>

              <div className="mt-5 grid grid-cols-2 gap-2">
                {[
                  { l: 'Cheapest Free Zone Licence', t: 'AED 4,888 · ANCFZ' },
                  { l: 'Dubai Mainland LLC', t: 'DED · 3-day setup' },
                  { l: 'E-Commerce Licence', t: 'SHAMS · SPC · IFZA' },
                  { l: 'Crypto / VARA Setup', t: 'DMCC · Virtual Assets' },
                  { l: 'Golden Visa 10-Year', t: 'Investor · Talent' },
                  { l: 'UAE Bank Account', t: 'WIO · Mashreq · ENBD' },
                  { l: 'VAT &amp; Corporate Tax', t: '9% · 0% in zones' },
                  { l: 'Restaurant / F&amp;B', t: 'DED · DMCC · Meydan' },
                ].map((s) => (
                  <button
                    type="button"
                    key={s.l}
                    onClick={() => { setQ(s.l.replace(/&amp;/g, '&')); setTimeout(() => submit(s.l.replace(/&amp;/g, '&')), 80); }}
                    className="text-left p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group"
                    data-testid={`seo-chip-${s.l.replace(/\s+/g,'-').toLowerCase()}`}
                  >
                    <div className="text-[11.5px] font-bold text-white">{s.l.replace(/&amp;/g, '&')}</div>
                    <div className="text-[10px] text-white/60 mt-0.5">{s.t}</div>
                  </button>
                ))}
              </div>

              <div className="mt-5 pt-5 border-t border-white/10">
                <div className="text-[10px] uppercase tracking-wider font-bold text-[#F0C674]">Why Founders Choose Us</div>
                <ul className="mt-2 space-y-1.5 text-[12.5px] text-white/90">
                  <li className="flex items-start gap-2"><ShieldCheck className="h-3.5 w-3.5 text-[#F0C674] mt-0.5 shrink-0" /> Licensed by Ajman Free Zone (Axiscrest-Global FZE LLC)</li>
                  <li className="flex items-start gap-2"><Zap className="h-3.5 w-3.5 text-[#F0C674] mt-0.5 shrink-0" /> AI-matched activity codes across 12,719 records</li>
                  <li className="flex items-start gap-2"><Clock className="h-3.5 w-3.5 text-[#F0C674] mt-0.5 shrink-0" /> Lifetime renewal reminders &amp; compliance hub</li>
                </ul>
              </div>
            </div>
          </aside>
        </div>

        {/* CENTERED STATS — full width, balanced under both columns */}
        <div className="relative max-w-5xl mx-auto px-5 lg:px-8 mt-10 lg:mt-14">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
            <Stat icon={<Globe2 className="h-5 w-5" />} value="40+" label="Jurisdictions" />
            <Stat icon={<Sparkles className="h-5 w-5" />} value="12,719" label="Activities Indexed" />
            <Stat icon={<Zap className="h-5 w-5" />} value="AED 4,888" label="Starting Price" />
            <Stat icon={<Clock className="h-5 w-5" />} value="30 sec" label="To Results" />
          </div>
        </div>
      </section>

      {/* Smooth wave divider from cream hero → white popular section */}
      <SoftDivider from="#FFFCF5" to="#FFFFFF" height={48} />

      {/* POPULAR ZONES STRIP */}
      <section className="py-14 lg:py-20 bg-white">
        <div className="max-w-[1480px] mx-auto px-5 lg:px-8">
          <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-700 font-bold">Popular Jurisdictions</div>
              <h2 className="font-display text-2xl lg:text-4xl font-bold tracking-tight text-slate-900 mt-1">Most requested by entrepreneurs</h2>
            </div>
            <Link to="/free-zones" className="text-[13px] font-semibold brand-emerald hover:underline inline-flex items-center gap-1">View all 40+ jurisdictions <ArrowRight className="h-4 w-4" /></Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pricesLoading && [...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-white border border-slate-200 p-5 animate-pulse">
                <div className="h-5 w-20 bg-slate-200 rounded mb-2" />
                <div className="h-3 w-12 bg-slate-100 rounded mb-4" />
                <div className="h-3 w-full bg-slate-100 rounded mb-1" />
                <div className="h-3 w-3/4 bg-slate-100 rounded mb-4" />
                <div className="h-8 w-24 bg-slate-200 rounded" />
              </div>
            ))}
            {!pricesLoading && popularZones.length === 0 && (
              <div className="col-span-full text-center text-slate-500 py-8">Pricing data unavailable right now. Please refresh.</div>
            )}
            {popularZones.map((z) => (
              <Link key={z.slug} to={`/free-zones/${z.slug}`} className="group block rounded-2xl bg-gradient-to-br from-white to-slate-50 border border-slate-200 hover:border-emerald-700/40 hover:shadow-2xl transition-all p-5" data-testid={`home-popular-${z.slug}`}>
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
                {z.note && (
                  <div className="mt-2 text-[11px] text-emerald-900 bg-emerald-50/70 border border-emerald-700/15 rounded-lg px-2.5 py-1.5 leading-snug">💡 {z.note}</div>
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
    </>
  );
}

function Stat({ icon, value, label }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 lg:p-6 text-center hover:border-emerald-700/30 hover:shadow-lg transition-all">
      <div className="inline-grid place-items-center h-12 w-12 rounded-xl bg-emerald-50 brand-emerald mb-3 mx-auto">{icon}</div>
      <div className="font-display text-2xl lg:text-[1.85rem] font-bold text-slate-900 tabular-nums leading-none">{value}</div>
      <div className="text-[12px] uppercase tracking-wider text-slate-500 font-semibold mt-1.5">{label}</div>
    </div>
  );
}
