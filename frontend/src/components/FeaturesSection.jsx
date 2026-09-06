import React from 'react';
import { FEATURES, PLATFORM_STRENGTHS } from '../mock';
import { Scale, Eye, Rocket, BadgePercent, HandCoins, Globe, Sparkles } from 'lucide-react';

const ICONS = { Scale, Eye, Rocket, BadgePercent, HandCoins, Globe, Sparkles };

export function ArchitecturalAdvantage() {
  return (
    <section className="py-14 lg:py-20 bg-[#F8F3E8]">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 lg:sticky lg:top-28 reveal">
            <div className="text-[11px] uppercase tracking-[0.22em] font-semibold brand-bronze">The Architectural Advantage</div>
            <h2 className="mt-4 font-display text-4xl lg:text-6xl font-semibold text-slate-900 leading-[1.02]">
              Data-driven decisions,<br />
              <span className="shine-text">unbiased comparison.</span>
            </h2>
            <p className="mt-5 text-slate-600 text-lg max-w-md">We leverage institutional-grade intelligence to help you navigate UAE business setup without any sales pressure.</p>
            <div className="mt-7 inline-flex items-center gap-3 p-4 rounded-2xl bg-white border border-emerald-900/10">
              <div className="h-12 w-12 rounded-xl bg-emerald-50 grid place-items-center">
                <Sparkles className="h-5 w-5 brand-emerald" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold">First 500 Clients</div>
                <div className="font-display text-lg font-semibold text-slate-900">AED 0 advisory fee</div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-7 space-y-5">
            {FEATURES.map((f, i) => {
              const Icon = ICONS[f.icon] || Sparkles;
              return (
                <div key={f.title} className="card-elevated rounded-2xl p-7 lg:p-8 reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                  <div className="flex items-start gap-5">
                    <div className="h-12 w-12 rounded-xl bg-emerald-50 grid place-items-center shrink-0">
                      <Icon className="h-5 w-5 brand-emerald" />
                    </div>
                    <div>
                      <div className="font-display text-xl lg:text-2xl font-semibold text-slate-900">{f.title}</div>
                      <p className="mt-2 text-slate-600 leading-relaxed">{f.body}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export function PlatformStrengthsSection() {
  return (
    <section className="py-14 lg:py-20 bg-[#FFFCF5]">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <div className="max-w-2xl reveal">
          <div className="text-[11px] uppercase tracking-[0.22em] font-semibold brand-bronze">Platform Strengths</div>
          <h2 className="mt-3 font-display text-4xl lg:text-5xl font-semibold text-slate-900 leading-[1.05]">Why founders choose SmartSetupUAE</h2>
        </div>
        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLATFORM_STRENGTHS.map((s, i) => {
            const Icon = ICONS[s.icon] || Sparkles;
            return (
              <div key={s.title} className="card-elevated rounded-2xl p-6 reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="h-11 w-11 rounded-xl bg-amber-50 grid place-items-center">
                  <Icon className="h-5 w-5 brand-bronze" />
                </div>
                <div className="font-display text-lg font-semibold mt-5 text-slate-900">{s.title}</div>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
