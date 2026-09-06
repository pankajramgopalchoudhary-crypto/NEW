import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Sparkles, Search, ArrowRight, ShieldCheck, Globe2, Clock, Zap, ChevronDown } from 'lucide-react';
import PageFAQ from '../components/PageFAQ';
import { faqAi } from '../constants/pageFaqs';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AISearch from '../components/AISearch';
import { searchActivities } from '../lib/activitySearchService';

// Premium hero that wraps AISearch. Auto-runs the query passed from Home hero
// (so the user lands directly on a result page, not an empty search bar).
export default function AISearchPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialQ = params.get('q') || '';
  const initialNat = params.get('nat') || '';
  const initialVisas = params.get('visas') || '';
  const initialBudget = params.get('budget') || '';

  const [q, setQ] = useState(initialQ);
  const [suggestions, setSuggestions] = useState([]);
  const [advancedOpen, setAdvancedOpen] = useState(Boolean(initialNat || initialVisas || initialBudget));
  const [nationality, setNationality] = useState(initialNat);
  const [visas, setVisas] = useState(initialVisas || '1');
  const [budget, setBudget] = useState(initialBudget);
  const ariaTriggerRef = useRef(null);

  // Live activity suggestions for the hero search input
  useEffect(() => {
    if (!q || q.length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      try { setSuggestions(await searchActivities(q, { limit: 6 })); } catch { setSuggestions([]); }
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const updateUrl = (next) => {
    const sp = new URLSearchParams();
    if (next.q) sp.set('q', next.q);
    if (next.nat) sp.set('nat', next.nat);
    if (next.visas) sp.set('visas', next.visas);
    if (next.budget) sp.set('budget', next.budget);
    navigate(`/ai-search?${sp.toString()}`, { replace: true });
  };

  const runSearch = (newQ) => {
    const term = (newQ ?? q).trim();
    if (!term) return;
    setSuggestions([]);
    updateUrl({ q: term, nat: nationality, visas, budget });
    // Bridge: AISearch component listens for this custom event and runs its
    // internal search + recommendation pipeline.
    window.dispatchEvent(new CustomEvent('ssu:ai-search:run', { detail: { q: term } }));
    setTimeout(() => {
      const el = document.getElementById('ai-search');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const heroLabel = useMemo(() => {
    if (!initialQ) return 'Find your perfect UAE setup';
    return `Best UAE setup for "${initialQ}"`;
  }, [initialQ]);

  return (
    <div>
      <Navbar />

      {/* ─────────────────────────────────────────────────────────────
          PREMIUM HERO (matches home aesthetic — cream + emerald + bronze)
          ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-6 pb-10 lg:pt-10 lg:pb-14">
        <div className="absolute inset-0 pointer-events-none opacity-60">
          <div className="absolute -top-20 -right-32 w-[700px] h-[700px] rounded-full bg-emerald-200/30 blur-3xl" />
          <div className="absolute top-40 -left-20 w-[500px] h-[500px] rounded-full bg-amber-200/25 blur-3xl" />
        </div>

        <div className="relative max-w-[1480px] mx-auto px-5 lg:px-8">
          <div className="flex justify-center mb-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-700/8 border border-emerald-700/15 text-emerald-800 text-[11.5px] font-bold uppercase tracking-[0.18em]">
              <Sparkles className="h-3 w-3" />
              AI Activity Search · 12,719 activities indexed · Official UAE data
            </div>
          </div>

          <h1 className="hero-h1 text-center font-display font-bold tracking-tight text-slate-900"
              style={{ fontSize: 'clamp(2.2rem, 4.6vw, 4.4rem)', lineHeight: 1.04 }}
              data-testid="ai-search-hero-headline">
            {initialQ ? (
              <>Best UAE setup for <span className="brand-emerald italic">&ldquo;{initialQ}&rdquo;</span></>
            ) : (
              <>Find <span className="brand-emerald">your activity</span>.<br />Get <span className="brand-bronze italic">your match</span>.</>
            )}
          </h1>

          <p className="text-center text-slate-700 max-w-3xl mx-auto mt-4" style={{ fontSize: 'clamp(1rem, 1.2vw, 1.2rem)' }}>
            Aria scans every UAE free-zone &amp; mainland activity list, ranks all matching jurisdictions on cost · speed · visas, and gives you the cheapest legal setup in under 30 seconds.
          </p>

          {/* SEARCH BAR — wider to fit long activity names */}
          <div className="mt-6 max-w-3xl mx-auto" data-testid="ai-search-hero-bar">
            <div className="relative">
              <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none z-10">
                <Search className="h-5 w-5 text-emerald-700" />
              </div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && q && runSearch()}
                placeholder="Type a business activity… e.g., Gold Trading, SaaS Software, Cafe"
                className="w-full h-16 lg:h-[72px] pl-14 pr-[170px] sm:pr-[190px] text-base lg:text-lg rounded-2xl bg-white border-2 border-emerald-700/15 shadow-xl shadow-emerald-900/10 focus:outline-none focus:border-emerald-700 transition-colors placeholder:text-slate-400"
                data-testid="ai-search-hero-input"
              />
              <button
                ref={ariaTriggerRef}
                onClick={() => q && runSearch()}
                disabled={!q}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 px-4 sm:px-6 h-12 lg:h-14 rounded-xl bg-emerald-700 text-white font-semibold disabled:opacity-50 hover:bg-emerald-800 transition-colors text-sm lg:text-base shadow-lg shadow-emerald-900/20"
                data-testid="ai-search-hero-submit"
              >
                Search <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {/* Suggestions dropdown */}
            {suggestions.length > 0 && (
              <div className="mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-left">
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => { setQ(s.activity_name); runSearch(s.activity_name); }}
                          className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors border-b border-slate-100 last:border-b-0 flex items-center gap-3">
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

            <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mr-1">Try:</span>
                {['IT / Software Development', 'General Trading', 'E-Commerce', 'Consultancy', 'Marketing Services', 'Real Estate Brokerage', 'F&B / Restaurant', 'Crypto / VARA'].map((s) => (
                  <button key={s} onClick={() => { setQ(s); runSearch(s); }}
                          className="text-[11.5px] px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700 hover:border-emerald-700 hover:brand-emerald transition-colors">
                    {s}
                  </button>
                ))}
              </div>
              <button onClick={() => setAdvancedOpen((o) => !o)}
                      className="text-[12px] font-semibold brand-emerald inline-flex items-center gap-1 hover:underline">
                {advancedOpen ? 'Hide' : 'Advanced filters'} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {advancedOpen && (
              <div className="mt-3 rounded-2xl bg-white border border-slate-200 p-4 lg:p-5 grid grid-cols-1 sm:grid-cols-3 gap-3 fade-up">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Nationality</label>
                  <input value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="e.g., Indian"
                         className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-700" />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold"># of visas</label>
                  <select value={visas} onChange={(e) => setVisas(e.target.value)}
                          className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-700 bg-white">
                    <option value="0">0 (licence only)</option><option value="1">1 visa</option><option value="2">2 visas</option><option value="3">3 visas</option><option value="5">5 visas</option><option value="10">10+ visas</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Budget (AED)</label>
                  <select value={budget} onChange={(e) => setBudget(e.target.value)}
                          className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-700 bg-white">
                    <option value="">Any budget</option><option value="5000">Under AED 5,000</option><option value="10000">Under AED 10,000</option><option value="20000">Under AED 20,000</option><option value="50000">Under AED 50,000</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Trust strip */}
          <div className="mt-7 flex items-center justify-center flex-wrap gap-x-6 gap-y-2 text-[12px] text-slate-600">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Free to use</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> No sign-up required</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Results in 30 seconds</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-700" /> Axiscrest-Global FZE LLC</span>
          </div>

          {/* Stats */}
          <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 max-w-4xl mx-auto">
            <Stat icon={<Globe2 className="h-5 w-5" />} value="40+" label="Jurisdictions" />
            <Stat icon={<Sparkles className="h-5 w-5" />} value="12,719" label="Activities Indexed" />
            <Stat icon={<Zap className="h-5 w-5" />} value="AED 4,888" label="Starting Price" />
            <Stat icon={<Clock className="h-5 w-5" />} value="30 sec" label="To Results" />
          </div>

          {!initialQ && (
            <div className="mt-9 text-center">
              <Link to="/free-zones" className="inline-flex items-center gap-1.5 text-[13px] font-semibold brand-emerald hover:underline">
                Or browse all 40+ free zones <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Live results section — AISearch listens for the ssu:ai-search:run event */}
      <AISearch autoQuery={initialQ} hideSearchBar />

      {/* WHY-USE-IT + FAQ block — visible when no result yet, plus permanent footer info */}
      {!initialQ && (
        <section className="py-14 bg-white border-t border-slate-200/70">
          <div className="max-w-[1480px] mx-auto px-5 lg:px-8 grid md:grid-cols-3 gap-6">
            <div className="card-elevated rounded-2xl p-6">
              <div className="text-[10px] uppercase tracking-[0.22em] font-bold brand-emerald">Why AI Search</div>
              <h3 className="font-display text-xl font-semibold text-slate-900 mt-2">12,719 activities indexed</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">Every UAE freezone publishes its own activity list with different codes. We aggregated them all so you can search once and instantly see who supports your exact business.</p>
            </div>
            <div className="card-elevated rounded-2xl p-6">
              <div className="text-[10px] uppercase tracking-[0.22em] font-bold brand-emerald">No commission bias</div>
              <h3 className="font-display text-xl font-semibold text-slate-900 mt-2">Pricing from official sources</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">Most consultants push the freezone that pays them the highest commission. We earn zero commission. The ranking is purely cost, speed, visa quota and activity fit.</p>
            </div>
            <div className="card-elevated rounded-2xl p-6">
              <div className="text-[10px] uppercase tracking-[0.22em] font-bold brand-emerald">30-second match</div>
              <h3 className="font-display text-xl font-semibold text-slate-900 mt-2">Free, no signup</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">Type your activity, get ranked options, download a PDF or jump straight to checkout. We only ask for contact details if you want to start the application.</p>
            </div>
          </div>

          <div className="max-w-[900px] mx-auto px-5 lg:px-8 mt-12">
            <PageFAQ title="AI Activity Search — Frequently Asked Questions" intro="How our 12,719-activity index works, how the cheapest freezone is calculated, ISIC mapping and pricing accuracy." items={faqAi} testId="ai-faq" />
          </div>
        </section>
      )}

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
