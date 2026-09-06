// Interactive loader for AI search — animated zone score bars rising in real-time.
// Keeps the user engaged for the 1-3 seconds it takes to query Supabase + rank.
import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

const STEPS = [
  'Reading your business activity…',
  'Cross-referencing 12,719 UAE activity codes…',
  'Scoring 115 freezone packages against your needs…',
  'Checking visa quotas + banking access…',
  'Ranking by cost + speed + match quality…',
  'Finalising your top-3…',
];

export default function InteractiveLoader({ allPackages = [] }) {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState({});

  // Step ticker — advance every ~450ms
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 450);
    return () => clearInterval(t);
  }, []);

  // Zones to animate (top 8 cheapest)
  const zones = React.useMemo(() => {
    const byZone = new Map();
    (allPackages || []).forEach((p) => {
      const fz = p.freezone_name || p.slug;
      if (!fz) return;
      const cur = byZone.get(fz);
      if (!cur || (p.base_price || 0) < (cur.base_price || 0)) byZone.set(fz, p);
    });
    return [...byZone.values()].sort((a, b) => (a.base_price || 0) - (b.base_price || 0)).slice(0, 8);
  }, [allPackages]);

  // Animate score bars upward
  useEffect(() => {
    if (zones.length === 0) return;
    let cancelled = false;
    zones.forEach((z, i) => {
      const target = 45 + Math.random() * 50; // 45-95
      let v = 0;
      const interval = setInterval(() => {
        if (cancelled) { clearInterval(interval); return; }
        v += 2 + Math.random() * 3;
        if (v >= target) { v = target; clearInterval(interval); }
        setScores((prev) => ({ ...prev, [z.freezone_name || z.slug]: v }));
      }, 60 + i * 15);
    });
    return () => { cancelled = true; };
  }, [zones]);

  return (
    <div className="rounded-3xl bg-gradient-to-br from-emerald-50 via-white to-amber-50 border border-emerald-700/15 p-6 lg:p-8 shadow-md max-w-3xl mx-auto">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="h-8 w-8 rounded-full bg-emerald-700 grid place-items-center">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <div className="font-display text-lg font-bold text-emerald-900">Aria is matching you…</div>
          <div className="text-[12px] text-slate-600 transition-opacity">{STEPS[step]}</div>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {zones.map((z, i) => {
          const name = z.freezone_name || z.slug;
          const score = scores[name] || 0;
          return (
            <div key={name + i} className="flex items-center gap-3">
              <div className="w-20 text-[12px] font-semibold text-slate-700 truncate">{name}</div>
              <div className="flex-1 h-2.5 bg-slate-200/70 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-800 transition-all duration-300 ease-out"
                  style={{ width: `${score}%` }}
                />
              </div>
              <div className="w-12 text-right text-[11px] font-bold tabular-nums text-slate-600">{Math.round(score)}%</div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 pt-4 border-t border-emerald-700/10">
        <Stat label="Zones scanned" value={zones.length || '…'} />
        <Stat label="Activities" value="12,719" />
        <Stat label="Live data" value="✓ Supabase" />
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="text-center">
      <div className="font-display text-base font-bold text-emerald-900 tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-0.5">{label}</div>
    </div>
  );
}
