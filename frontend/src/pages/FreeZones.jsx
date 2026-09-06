import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PageFAQ from '../components/PageFAQ';
import { faqFreezone } from '../constants/pageFaqs';
import { ZONES, COMING_SOON_JURISDICTIONS } from '../data/zones';
import { loadFreezonePackages, mergeZonesWithLivePackages } from '../lib/pricingService';
import { Building2, Clock, Users2, Sparkles, Filter, ArrowUpRight, MapPin, LayoutGrid, List, Rows3, Maximize2 } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const BADGE = {
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  bronze: 'bg-amber-50 text-amber-800 border-amber-200',
};

export default function FreeZones() {
  const [params] = useSearchParams();
  const compareTerm = params.get('compare') || '';
  const [q, setQ] = useState(compareTerm);
  const [sort, setSort] = useState('price-asc');
  const [emirate, setEmirate] = useState('all');
  const [view, setView] = useState('cards'); // large, cards, compact, list
  const [livePackages, setLivePackages] = useState([]);

  useEffect(() => {
    let cancelled = false;
    loadFreezonePackages()
      .then((rows) => { if (!cancelled) setLivePackages(rows); })
      .catch(() => { if (!cancelled) setLivePackages([]); });
    return () => { cancelled = true; };
  }, []);

  const liveZones = useMemo(() => mergeZonesWithLivePackages(ZONES, livePackages), [livePackages]);

  useEffect(() => {
    if (compareTerm && compareTerm !== q) {
      setQ(compareTerm);
    }
  }, [compareTerm, q]);

  const filtered = liveZones
    .filter((fz) => [fz.name, fz.fullName, fz.loc, fz.tag, ...fz.best].join(' ').toLowerCase().includes(q.toLowerCase()))
    .filter((fz) => emirate === 'all' || fz.emirate === emirate)
    .sort((a, b) => sort === 'price-asc' ? a.gov - b.gov : sort === 'price-desc' ? b.gov - a.gov : 0);

  return (
    <div>
      <Navbar />
      <section className="hero-gradient grain">
        <div className="max-w-[1480px] mx-auto px-5 lg:px-8 pt-3 lg:pt-6 pb-9 text-center">
          <div className="inline-flex items-center gap-2 fade-up justify-center">
            <Sparkles className="h-4 w-4 brand-bronze" />
            <span className="text-xs uppercase tracking-[0.22em] text-slate-600 font-semibold">Free Zone Finder</span>
          </div>
          <h1 className="mt-4 font-display font-semibold text-slate-900 fade-up delay-100" style={{ fontSize: 'clamp(2.4rem, 5vw, 4.6rem)', lineHeight: 1.04 }}>Every UAE<br /><span className="shine-text">free zone, ranked.</span></h1>
          <p className="mt-3 text-slate-600 max-w-3xl mx-auto fade-up delay-200" style={{ fontSize: 'clamp(0.95rem, 1.1vw, 1.125rem)' }}>Compare cost, visa quota, activity rules and setup speed across all 40+ UAE free zones — live data from Supabase. Includes <b>IFZA</b>, <b>ANCFZ</b>, <b>SHAMS</b>, <b>SPC</b>, <b>RAKEZ</b>, <b>DMCC</b>, <b>Meydan</b>, <b>DAFZA</b> and more.</p>
          {compareTerm && (
            <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 max-w-3xl mx-auto fade-up delay-250">
              Showing comparison results for <span className="font-semibold">{compareTerm}</span>. Use the search box to refine your shortlist.
            </div>
          )}

          <div className="mt-7 flex flex-col md:flex-row gap-3 max-w-4xl mx-auto fade-up delay-300">
            <div className="relative flex-1">
              <Filter className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by zone, location, or activity…" className="h-12 pl-11 rounded-full border-slate-200" />
            </div>
            <Select value={emirate} onValueChange={setEmirate}>
              <SelectTrigger className="w-full md:w-44 h-12 rounded-full"><SelectValue placeholder="Emirate" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All emirates</SelectItem>
                <SelectItem value="dubai">Dubai</SelectItem>
                <SelectItem value="sharjah">Sharjah</SelectItem>
                <SelectItem value="ajman">Ajman</SelectItem>
                <SelectItem value="rak">Ras Al Khaimah</SelectItem>
                <SelectItem value="abudhabi">Abu Dhabi</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-full md:w-52 h-12 rounded-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="price-asc">Price: Low to High</SelectItem>
                <SelectItem value="price-desc">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* View modes — centered */}
          <div className="mt-5 flex items-center justify-center gap-2 fade-up delay-400 flex-wrap">
            <span className="text-[11px] uppercase tracking-[0.22em] font-semibold text-slate-500">View:</span>
            <div className="flex p-1 bg-white border border-slate-200 rounded-full">
              {[
                { id: 'large', i: Maximize2, l: 'Large' },
                { id: 'cards', i: LayoutGrid, l: 'Cards' },
                { id: 'compact', i: Rows3, l: 'Compact' },
                { id: 'list', i: List, l: 'List' },
              ].map((v) => (
                <button key={v.id} onClick={() => setView(v.id)} className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition flex items-center gap-1.5 ${view === v.id ? 'bg-brand-emerald text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}>
                  <v.i className="h-3.5 w-3.5" /> {v.l}
                </button>
              ))}
            </div>
            <div className="text-xs text-slate-500 ml-2">{filtered.length} results</div>
          </div>
        </div>
      </section>

      <section className="py-12 bg-[#FFFCF5]">
        <div className="max-w-[1480px] mx-auto px-5 lg:px-8">
          {view === 'large' && (
            <div className="space-y-6">
              {filtered.map((fz, i) => (
                <Link to={`/free-zones/${fz.slug}`} key={fz.id} className="card-elevated rounded-3xl p-7 lg:p-10 grid lg:grid-cols-12 gap-6 group fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="lg:col-span-8">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-[10px] uppercase tracking-[0.2em] font-bold px-2.5 py-1 rounded-full border ${BADGE[fz.color]}`}>{fz.tag}</span>
                      <span className="flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3 w-3" /> {fz.loc}</span>
                    </div>
                    <div className="font-display text-3xl lg:text-4xl font-semibold text-slate-900 mt-3 group-hover:brand-emerald transition-colors">{fz.fullName}</div>
                    <p className="mt-3 text-slate-600 max-w-2xl">{fz.highlight}</p>
                    <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div><div className="text-slate-500">Activities</div><div className="font-semibold text-slate-800 mt-0.5">{fz.acts}</div></div>
                      <div><div className="text-slate-500">Visas</div><div className="font-semibold text-slate-800 mt-0.5">{fz.maxVis}</div></div>
                      <div><div className="text-slate-500">Timeline</div><div className="font-semibold text-slate-800 mt-0.5">{fz.proc}</div></div>
                      <div><div className="text-slate-500">Office</div><div className="font-semibold text-slate-800 mt-0.5">{fz.physical.split('/')[0]}</div></div>
                    </div>
                  </div>
                  <div className="lg:col-span-4 flex flex-col justify-between gap-3 lg:items-end lg:text-right">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">From</div>
                      <div className="font-display text-3xl font-bold text-slate-900">AED {fz.gov.toLocaleString()}</div>
                      <div className="text-xs text-slate-500">With visa: AED {fz.govVisa.toLocaleString()}</div>
                    </div>
                    <Button size="sm" className="btn-primary rounded-full h-10 px-5">View Details <ArrowUpRight className="h-3.5 w-3.5 ml-1" /></Button>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {view === 'cards' && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((fz, i) => (
                <Link to={`/free-zones/${fz.slug}`} key={fz.id} className="card-elevated rounded-2xl p-6 group fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] uppercase tracking-[0.2em] font-bold px-2.5 py-1 rounded-full border ${BADGE[fz.color]}`}>{fz.tag}</span>
                    <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-brand-emerald group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
                  </div>
                  <div className="mt-5">
                    <div className="text-xs text-slate-500">{fz.loc}</div>
                    <div className="font-display text-2xl font-semibold text-slate-900 group-hover:brand-emerald transition-colors">{fz.name}</div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                    <div><div className="flex items-center gap-1 text-slate-500"><Building2 className="h-3 w-3" /> Acts</div><div className="font-semibold mt-0.5">{fz.acts}</div></div>
                    <div><div className="flex items-center gap-1 text-slate-500"><Users2 className="h-3 w-3" /> Visas</div><div className="font-semibold mt-0.5">{fz.maxVis}</div></div>
                    <div><div className="flex items-center gap-1 text-slate-500"><Clock className="h-3 w-3" /> Days</div><div className="font-semibold mt-0.5">{fz.proc.split(' ')[0]}</div></div>
                  </div>
                  <div className="mt-5 flex items-end justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">From</div>
                      <div className="font-display text-2xl font-bold text-slate-900">AED {fz.gov.toLocaleString()}</div>
                    </div>
                    <span className="text-xs font-semibold brand-emerald">View →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {view === 'compact' && (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filtered.map((fz, i) => (
                <Link to={`/free-zones/${fz.slug}`} key={fz.id} className="card-elevated rounded-xl p-4 group fade-up" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="text-[10px] uppercase tracking-[0.2em] font-bold brand-bronze">{fz.tag}</div>
                  <div className="font-display text-lg font-semibold text-slate-900 mt-1 group-hover:brand-emerald">{fz.name}</div>
                  <div className="text-xs text-slate-500">{fz.loc}</div>
                  <div className="mt-3 font-display text-xl font-bold text-slate-900">AED {fz.gov.toLocaleString()}</div>
                </Link>
              ))}
            </div>
          )}

          {view === 'list' && (
            <div className="card-elevated rounded-2xl overflow-hidden">
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 text-[11px] uppercase tracking-[0.18em] font-semibold text-slate-500">
                <div className="col-span-3">Free Zone</div>
                <div className="col-span-2">Location</div>
                <div className="col-span-2">Activities</div>
                <div className="col-span-2">Timeline</div>
                <div className="col-span-2">From (AED)</div>
                <div className="col-span-1 text-right">View</div>
              </div>
              {filtered.map((fz, i) => (
                <Link to={`/free-zones/${fz.slug}`} key={fz.id} className={`grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-5 items-center hover:bg-emerald-50/40 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-amber-50/30'}`}>
                  <div className="col-span-3">
                    <div className="font-semibold text-slate-900">{fz.name}</div>
                    <div className="text-[11px] uppercase tracking-[0.18em] brand-bronze font-semibold mt-0.5">{fz.tag}</div>
                  </div>
                  <div className="col-span-2 text-sm text-slate-600">{fz.loc}</div>
                  <div className="col-span-2 text-sm text-slate-700">{fz.acts}</div>
                  <div className="col-span-2 text-sm text-slate-700">{fz.proc}</div>
                  <div className="col-span-2 font-display font-semibold text-slate-900">{fz.gov.toLocaleString()}</div>
                  <div className="col-span-1 md:text-right text-xs font-semibold brand-emerald">View →</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Phase 4 — Jurisdictions pending verified pricing */}
      <section className="py-12 bg-[#F8F3E8]" data-testid="coming-soon-section">
        <div className="max-w-7xl mx-auto px-5 lg:px-8">
          <h2 className="font-display text-2xl lg:text-3xl font-semibold text-slate-900">More jurisdictions — pricing verification in progress</h2>
          <p className="mt-2 text-slate-600 text-sm max-w-2xl">We support these jurisdictions but only publish prices once verified. Request a quotation and we'll share the latest verified pricing.</p>
          <div className="mt-7 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {COMING_SOON_JURISDICTIONS.map((j) => (
              <div key={j.id} className="rounded-2xl border border-slate-200 bg-white p-5" data-testid={`coming-soon-${j.id}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">{j.status.replace('_', ' ')}</span>
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <div className="font-display text-lg font-semibold text-slate-900 mt-3">{j.name}</div>
                <div className="text-xs text-slate-500">{j.loc}</div>
                <div className="mt-3 text-sm text-slate-600">Pricing verification in progress.</div>
                <Link to={`/consultation?service=${encodeURIComponent(j.name)}`}>
                  <Button size="sm" variant="outline" className="rounded-full mt-4 border-slate-300 h-9 text-xs">Request Quotation</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
      <PageFAQ title="Free Zones — Common questions" intro="Cheapest UAE free zone, IFZA vs DMCC vs ANCFZ vs SHAMS, can you invoice mainland clients, remote incorporation, Corporate Tax for free zones." items={faqFreezone} testId="faq-freezones" />
      <Footer />
    </div>
  );
}
