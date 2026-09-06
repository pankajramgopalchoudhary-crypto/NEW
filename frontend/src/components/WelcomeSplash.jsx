import React, { useEffect, useState } from 'react';
import { Sparkles, Crown } from 'lucide-react';
import BrandLogo from './BrandLogo';

/**
 * Full-screen splash overlay shown after successful login.
 * Zooms a big welcome message in → holds → zooms out, then auto-dismisses.
 *
 *   variant="admin"  → "Welcome {name} — let's make founders' dreams come true"
 *   variant="client" → "Welcome {name} — let's start your founder journey, with love and sincerity"
 */
export default function WelcomeSplash({ name = '', variant = 'client', onDone, duration = 3000 }) {
  const [phase, setPhase] = useState('in'); // in → hold → out
  const isAdmin = variant === 'admin';
  const safeName = (name || '').split(' ')[0] || (isAdmin ? 'Admin' : 'Founder');

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase('hold'), 350);
    const t2 = window.setTimeout(() => setPhase('out'), duration - 550);
    const t3 = window.setTimeout(() => { if (onDone) onDone(); }, duration);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); window.clearTimeout(t3); };
  }, [duration, onDone]);

  const headline = isAdmin
    ? `Welcome, ${safeName}`
    : `Welcome, ${safeName}`;
  const subline = isAdmin
    ? `Let's make some founders achieve their dreams.`
    : `Let's start your founder journey — with love and sincerity.`;

  const wrapperClass =
    phase === 'in'
      ? 'opacity-0 scale-50'
      : phase === 'hold'
        ? 'opacity-100 scale-100'
        : 'opacity-0 scale-150';

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center transition-opacity duration-500"
      style={{
        background: 'radial-gradient(circle at 50% 40%, #13433f 0%, #0F2A2A 60%, #07181a 100%)',
        opacity: phase === 'out' ? 0 : 1,
      }}
      data-testid="welcome-splash"
    >
      <div
        className={`text-center px-6 transition-all duration-700 ease-out will-change-transform ${wrapperClass}`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-[#F0C674]/30 text-[10px] uppercase tracking-[0.22em] font-bold text-[#F0C674]">
          {isAdmin ? <Crown className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />} SmartSetupUAE · Setup Smart. Grow Fast.
        </div>
        <div className="mt-5 mx-auto inline-block" style={{ filter: 'drop-shadow(0 0 28px rgba(240,198,116,0.18)) brightness(1.08)' }}>
          <BrandLogo variant="dark" className="h-14" />
        </div>
        <h1
          className="mt-5 font-display font-bold text-white tracking-tight"
          style={{ fontSize: 'clamp(2.4rem, 7vw, 6rem)', lineHeight: 1 }}
        >
          {headline}
        </h1>
        <p className="mt-4 text-white/85 font-display italic text-lg lg:text-2xl max-w-2xl mx-auto">
          {subline}
        </p>
        <div className="mt-7 inline-flex items-center gap-2 text-[#F0C674] text-xs uppercase tracking-[0.22em] font-bold">
          <span className="h-1.5 w-1.5 rounded-full bg-[#F0C674] animate-pulse" /> Loading your dashboard
        </div>
      </div>
    </div>
  );
}
