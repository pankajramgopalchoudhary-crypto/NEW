/**
 * Compact currency switcher — for the Checkout sidebar.
 * Fetches live FX rates from /api/payments/currencies once on mount.
 * Renders: <select> + a small "≈ USD 1,330" preview line under the main AED amount.
 *
 * Usage:
 *   <CurrencySwitcher aedAmount={breakdown.total} />
 */
import React, { useEffect, useState } from 'react';
import { paymentsApi } from '../lib/backendApi';

const FALLBACK = [
  { code: 'AED', label: 'UAE Dirham', symbol: 'د.إ', rate_from_aed: 1.0 },
  { code: 'USD', label: 'US Dollar', symbol: '$', rate_from_aed: 0.272 },
  { code: 'EUR', label: 'Euro', symbol: '€', rate_from_aed: 0.24 },
  { code: 'GBP', label: 'British Pound', symbol: '£', rate_from_aed: 0.207 },
  { code: 'INR', label: 'Indian Rupee', symbol: '₹', rate_from_aed: 25.77 },
];

export default function CurrencySwitcher({ aedAmount = 0, compact = false }) {
  const [currencies, setCurrencies] = useState(FALLBACK);
  const [picked, setPicked] = useState('AED');

  useEffect(() => {
    let mounted = true;
    paymentsApi.currencies().then((r) => {
      if (!mounted) return;
      if (Array.isArray(r?.currencies) && r.currencies.length) setCurrencies(r.currencies);
    }).catch(() => { /* fallback already set */ });
    // Default to user locale (browser hint) if any of the 5 supported currencies fits.
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const lang = (navigator.language || 'en').toLowerCase();
      if (lang.startsWith('en-us') || tz.includes('America')) setPicked('USD');
      else if (lang.startsWith('en-gb') || tz.includes('London')) setPicked('GBP');
      else if (tz.includes('Europe')) setPicked('EUR');
      else if (lang.startsWith('hi') || tz.includes('Kolkata') || tz.includes('Calcutta')) setPicked('INR');
    } catch { /* ignore */ }
    return () => { mounted = false; };
  }, []);

  const cur = currencies.find((c) => c.code === picked) || currencies[0];
  const converted = Number(aedAmount || 0) * Number(cur.rate_from_aed || 0);
  const formatted = `${cur.symbol} ${converted.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <div className={compact ? '' : 'rounded-2xl bg-white border border-slate-200 p-4'} data-testid="currency-switcher">
      {!compact && (
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-slate-500">Show prices in</span>
          <select
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            className="h-8 text-xs rounded-md border border-slate-200 px-2 bg-white font-semibold"
            data-testid="currency-switcher-select"
          >
            {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.label}</option>)}
          </select>
        </div>
      )}
      {picked !== 'AED' && aedAmount > 0 && (
        <div className="text-[12px] text-slate-600 flex items-center gap-1" data-testid="currency-switcher-preview">
          <span>≈ <b className="text-slate-900">{formatted}</b></span>
          <span className="text-[10px] text-slate-400">· billed in AED · live rate</span>
        </div>
      )}
      {compact && picked === 'AED' && (
        <div className="text-[11px] text-slate-500">All prices shown in AED · click to change currency</div>
      )}
    </div>
  );
}
