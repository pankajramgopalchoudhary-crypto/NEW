import React, { useEffect, useState } from 'react';
import { MessageSquareText, X } from 'lucide-react';

// Shows a small "Need help choosing?" tooltip after the user has scrolled
// past ~60% of the page. Auto-hides after 12s if ignored. One-shot per session.
export default function SmartHelpTooltip({ onOpenEnquiry }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('ssu_help_tip_shown')) return;
    const handler = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      if (total > 0 && scrolled / total >= 0.6) {
        setShow(true);
        sessionStorage.setItem('ssu_help_tip_shown', '1');
        window.removeEventListener('scroll', handler);
        setTimeout(() => setShow(false), 12000);
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  if (!show) return null;
  return (
    <div
      data-testid="smart-help-tooltip"
      className="fixed bottom-[8.5rem] right-3 z-[56] max-w-[260px] rounded-2xl bg-white shadow-2xl ring-1 ring-emerald-900/10 p-3 animate-in fade-in slide-in-from-right-4 duration-300"
    >
      <button
        onClick={() => setShow(false)}
        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-slate-200 grid place-items-center text-slate-600 hover:bg-slate-300"
        aria-label="Dismiss"
        data-testid="smart-help-close"
      >
        <X className="h-3 w-3" />
      </button>
      <div className="flex items-start gap-2">
        <div className="h-8 w-8 rounded-full bg-emerald-50 grid place-items-center shrink-0">
          <MessageSquareText className="h-4 w-4 brand-emerald" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">Need help choosing?</div>
          <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
            Our advisors can shortlist the right free zone for you in under 5 minutes.
          </p>
          <button
            onClick={() => { setShow(false); onOpenEnquiry?.(); }}
            data-testid="smart-help-cta"
            className="mt-2 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-brand-emerald text-white hover:opacity-90"
          >
            Get my shortlist →
          </button>
        </div>
      </div>
    </div>
  );
}
