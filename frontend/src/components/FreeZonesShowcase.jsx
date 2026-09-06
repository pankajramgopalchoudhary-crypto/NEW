import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ZONES } from '../data/zones';
import { Building2, Clock, Users2, ArrowUpRight, MapPin } from 'lucide-react';
import { Button } from './ui/button';

const BADGE_COLOR = {
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  bronze: 'bg-amber-50 text-amber-800 border-amber-200',
};

export default function FreeZonesShowcase() {
  const [view, setView] = useState('cards');
  const featured = ZONES.slice(0, 6);

  return (
    <section id="free-zones" className="py-14 lg:py-20 bg-[#FFFCF5]">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <div className="flex items-end justify-between flex-wrap gap-4 reveal">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] font-semibold brand-bronze">Elite Jurisdictions</div>
            <h2 className="mt-3 font-display text-4xl lg:text-5xl font-semibold text-slate-900 leading-[1.05]">Popular Free Zones — Live Pricing</h2>
            <p className="mt-3 text-slate-600 max-w-xl">Hand-picked free zones with transparent total cost — not misleading "starting from" teaser pricing.</p>
          </div>
          <div className="flex items-center gap-2 p-1 rounded-full bg-slate-100">
            {['cards', 'list'].map((v) => (
              <button key={v} onClick={() => setView(v)} className={`text-xs font-semibold px-4 py-2 rounded-full capitalize transition ${view === v ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-900'}`}>{v}</button>
            ))}
          </div>
        </div>

        {view === 'cards' && (
          <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map((fz, i) => (
              <Link to={`/free-zones/${fz.slug}`} key={fz.id} className="card-elevated rounded-2xl p-6 reveal group" style={{ transitionDelay: `${i * 60}ms` }}>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] uppercase tracking-[0.2em] font-bold px-2.5 py-1 rounded-full border ${BADGE_COLOR[fz.color]}`}>{fz.tag}</span>
                  <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-brand-emerald group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
                </div>
                <div className="mt-5">
                  <div className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="h-3 w-3" /> {fz.loc}</div>
                  <div className="font-display text-2xl font-semibold text-slate-900 mt-0.5 group-hover:brand-emerald transition-colors">{fz.name}</div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-1 text-slate-500"><Building2 className="h-3 w-3" /> Activities</div>
                    <div className="font-semibold text-slate-800 mt-0.5">{fz.acts}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-slate-500"><Users2 className="h-3 w-3" /> Visas</div>
                    <div className="font-semibold text-slate-800 mt-0.5">{fz.maxVis}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-slate-500"><Clock className="h-3 w-3" /> Timeline</div>
                    <div className="font-semibold text-slate-800 mt-0.5">{fz.proc.split(' ')[0]}</div>
                  </div>
                </div>
                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">From</div>
                    <div className="font-display text-2xl font-bold text-slate-900">AED {fz.gov.toLocaleString()}</div>
                  </div>
                  <Button size="sm" className="btn-primary rounded-full h-9 px-4 text-xs">View Details</Button>
                </div>
              </Link>
            ))}
          </div>
        )}

        {view === 'list' && (
          <div className="mt-10 card-elevated rounded-2xl overflow-hidden">
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 text-[11px] uppercase tracking-[0.18em] font-semibold text-slate-500">
              <div className="col-span-3">Free Zone</div>
              <div className="col-span-2">Location</div>
              <div className="col-span-2">Activities</div>
              <div className="col-span-2">Timeline</div>
              <div className="col-span-2">From (AED)</div>
              <div className="col-span-1 text-right">Action</div>
            </div>
            {featured.map((fz, i) => (
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

        <div className="mt-10 text-center">
          <Link to="/free-zones" className="inline-flex items-center gap-2 text-sm font-semibold brand-emerald link-underline">
            View All Free Zones <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
