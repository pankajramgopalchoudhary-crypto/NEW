import React from 'react';
import { INDUSTRIES, PROCESS_STEPS, TESTIMONIALS } from '../mock';
import { ShoppingBag, Cpu, Truck, Sparkles } from 'lucide-react';

const ICONS = { ShoppingBag, Cpu, Truck, Sparkles };

export function IndustryRecommendations() {
  return (
    <section className="py-14 lg:py-20 section-gradient-emerald">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <div className="text-center max-w-2xl mx-auto reveal">
          <div className="text-[11px] uppercase tracking-[0.22em] font-semibold brand-bronze">Recommendations by Sector</div>
          <h2 className="mt-3 font-display text-4xl lg:text-5xl font-semibold text-slate-900 leading-[1.05]">What's right for your industry?</h2>
        </div>
        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {INDUSTRIES.map((ind, i) => {
            const Icon = ICONS[ind.icon] || Sparkles;
            return (
              <div key={ind.name} className="card-elevated rounded-2xl p-6 group reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="h-12 w-12 rounded-xl bg-emerald-50 grid place-items-center group-hover:scale-105 transition-transform">
                  <Icon className="h-5 w-5 brand-emerald" />
                </div>
                <div className="font-display text-xl font-semibold mt-5 text-slate-900">{ind.name}</div>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{ind.description}</p>
                <div className="mt-5 pt-4 border-t border-slate-100">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">Top Picks</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ind.top.map((t) => (
                      <span key={t} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-900/5 text-emerald-900 border border-emerald-900/10">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function ProcessSteps() {
  return (
    <section className="py-14 lg:py-20 bg-[#0F2A2A] text-[#F2EBD8] relative overflow-hidden">
      <div className="absolute -top-32 -right-20 h-96 w-96 rounded-full bg-[#B45309]/20 blur-3xl pointer-events-none" />
      <div className="max-w-7xl mx-auto px-5 lg:px-8 relative">
        <div className="max-w-2xl reveal">
          <div className="text-[11px] uppercase tracking-[0.22em] font-semibold text-[#F0C674]">The Process</div>
          <h2 className="mt-3 font-display text-4xl lg:text-5xl font-semibold text-white leading-[1.05]">From Search to Setup in 3 Steps</h2>
          <p className="mt-4 text-[#A9C0BB] text-lg">A clean, predictable path — from first comparison to a live trade licence in hand.</p>
        </div>
        <div className="mt-14 grid md:grid-cols-3 gap-6 lg:gap-10">
          {PROCESS_STEPS.map((s, i) => (
            <div key={s.no} className="relative reveal" style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-[#F0C674] grid place-items-center text-[#0F2A2A] font-display font-bold text-xl">{s.no}</div>
                <div className="h-px flex-1 bg-white/15" />
              </div>
              <div className="mt-6 font-display text-3xl font-semibold text-white">{s.title}</div>
              <p className="mt-3 text-[#A9C0BB] leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Testimonials() {
  return (
    <section className="py-14 lg:py-20 bg-[#F8F3E8] overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <div className="text-center max-w-2xl mx-auto reveal">
          <div className="text-[11px] uppercase tracking-[0.22em] font-semibold brand-bronze">What founders say</div>
          <h2 className="mt-3 font-display text-4xl lg:text-5xl font-semibold text-slate-900 leading-[1.05]">Honest words from real entrepreneurs</h2>
        </div>
      </div>
      <div className="mt-12 overflow-hidden">
        <div className="marquee gap-6 px-6">
          {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
            <div key={i} className="card-elevated rounded-2xl p-7 w-[380px] shrink-0">
              <div className="font-display text-lg text-slate-800 leading-relaxed">“{t.quote}”</div>
              <div className="mt-6 flex items-center gap-3">
                <img src={t.avatar} alt={t.name} className="h-11 w-11 rounded-full object-cover" />
                <div>
                  <div className="font-semibold text-slate-900 text-sm">{t.name}</div>
                  <div className="text-xs text-slate-500">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
