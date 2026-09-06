// Interactive "Aria is thinking..." loader — keeps users engaged during the
// ~3-8 second smart-rank call. Animates a sequence of steps + a spinning orbit
// so it never feels like a frozen screen.
import React, { useEffect, useState } from 'react';
import { Sparkles, Search, BarChart3, Wallet, ShieldCheck, CheckCircle2 } from 'lucide-react';

const STEPS = [
  { icon: <Search className="h-4 w-4" />,        label: 'Scanning 12,719 UAE activities…' },
  { icon: <Sparkles className="h-4 w-4" />,      label: 'Matching to 40+ jurisdictions…' },
  { icon: <BarChart3 className="h-4 w-4" />,     label: 'Comparing prices & visa quotas…' },
  { icon: <Wallet className="h-4 w-4" />,        label: 'Calculating your savings…' },
  { icon: <ShieldCheck className="h-4 w-4" />,   label: 'Verifying against official lists…' },
  { icon: <CheckCircle2 className="h-4 w-4" />,  label: 'Ranking your top 3 matches…' },
];

export default function AriaLoading({ query }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 1400);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10" data-testid="aria-loading">
      <div className="rounded-3xl bg-white border border-emerald-700/15 shadow-xl shadow-emerald-900/8 overflow-hidden">
        {/* Pulse header */}
        <div className="px-6 lg:px-8 pt-7 pb-5 bg-gradient-to-br from-emerald-700/5 to-amber-100/30 border-b border-emerald-700/10">
          <div className="flex items-center gap-4">
            <div className="relative h-14 w-14 shrink-0">
              <div className="absolute inset-0 rounded-full aria-orbit" />
              <div className="absolute inset-[6px] rounded-full bg-emerald-700 grid place-items-center text-white">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10.5px] uppercase tracking-[0.22em] text-emerald-700 font-bold">Aria · AI Concierge</div>
              <div className="font-display text-lg lg:text-xl font-bold text-slate-900 truncate">
                {query ? <>Finding your best UAE setup for <span className="brand-emerald">&ldquo;{query}&rdquo;</span></> : 'Finding your best UAE setup…'}
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 aria-pulse-dot" style={{ animationDelay: '0s' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 aria-pulse-dot" style={{ animationDelay: '0.2s' }} />
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 aria-pulse-dot" style={{ animationDelay: '0.4s' }} />
                <span className="ml-1 text-[11px] text-slate-500">typically 3-8 seconds</span>
              </div>
            </div>
          </div>
        </div>

        {/* Animated step list */}
        <ol className="px-6 lg:px-8 py-5 space-y-2.5">
          {STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={i}
                  className={`aria-loading-step flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                    active ? 'bg-emerald-50 border border-emerald-200' :
                    done   ? 'opacity-60' :
                             'opacity-35'
                  }`}
                  style={{ animationDelay: `${i * 60}ms` }}>
                <div className={`h-7 w-7 grid place-items-center rounded-lg shrink-0 ${
                  done ? 'bg-emerald-700 text-white' : active ? 'bg-emerald-100 brand-emerald' : 'bg-slate-100 text-slate-400'
                }`}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : s.icon}
                </div>
                <span className={`text-sm font-medium ${active ? 'text-slate-900' : done ? 'text-slate-600 line-through decoration-emerald-700/30' : 'text-slate-500'}`}>
                  {s.label}
                </span>
                {active && <span className="ml-auto text-[10px] uppercase tracking-wider font-bold brand-emerald">Working</span>}
              </li>
            );
          })}
        </ol>

        {/* Footer tip — keeps visitors engaged */}
        <div className="px-6 lg:px-8 pb-6 pt-2 border-t border-slate-100">
          <div className="text-[12px] text-slate-600">
            💡 <b className="text-slate-800">Did you know?</b> The cheapest UAE freezone licence costs just <b className="brand-emerald">AED 4,888</b> with zero visas — about <b className="brand-emerald">USD 1,330</b>. We'll show you all options ranked by total cost.
          </div>
        </div>
      </div>
    </div>
  );
}
