/**
 * Referral panel — shows the client's unique code, share URL, stats and rewards.
 * Embedded inside the client Dashboard (right column).
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Gift, Copy, Share2, CheckCircle2, Coins, Percent, Sparkles, ArrowRight } from 'lucide-react';
import { api } from '../lib/backendApi';
import { Button } from './ui/button';
import { useToast } from '../hooks/use-toast';

export default function ReferralPanel() {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try { setData(await api.get('/api/referral/me')); }
    catch (e) { console.warn('referral load failed', e); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: 'Copied', description: 'Share it with a founder friend.' });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ title: 'Copy failed' });
    }
  };

  const share = async () => {
    if (!data?.share_url) return;
    const payload = {
      title: 'SmartSetupUAE — UAE company formation, made simple',
      text: `Use my code ${data.code} for AED 50 off your first SmartSetupUAE order.`,
      url: data.share_url,
    };
    if (navigator.share) {
      try { await navigator.share(payload); return; } catch { /* user cancelled */ }
    }
    copy(`${payload.text} ${payload.url}`);
  };

  if (busy) {
    return (
      <div className="card-elevated rounded-2xl p-6" data-testid="ref-loading">
        <div className="h-4 w-32 bg-slate-100 animate-pulse rounded" />
        <div className="mt-3 h-10 w-full bg-slate-100 animate-pulse rounded" />
      </div>
    );
  }
  if (!data) return null;

  const rules = data.rules || {};
  const earned = data.rewards?.earned_cashback_aed || 0;
  const percent = data.rewards?.available_percent_off || 0;

  return (
    <div className="rounded-2xl overflow-hidden border border-amber-200 shadow-lg" data-testid="referral-panel">
      <div className="bg-gradient-to-br from-[#0F2A2A] to-[#13433f] text-white p-6">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5" style={{ color: '#F0C674' }} />
          <div className="text-[11px] uppercase tracking-[0.22em] font-bold" style={{ color: '#F0C674' }}>Refer &amp; Earn</div>
        </div>
        <h3 className="mt-2 font-display text-2xl font-semibold leading-tight">
          Earn <span style={{ color: '#F0C674' }}>AED {rules.referrer_cashback_aed || 50}</span> + <span style={{ color: '#F0C674' }}>{rules.referrer_percent_off || 5}%</span> off
          <span className="block text-base text-white/80 font-normal mt-1">for every founder you bring in.</span>
        </h3>
        <p className="text-[12.5px] text-white/70 mt-2">Your friend gets AED {rules.referee_cashback_aed || 50} off their first order. {rules.valid_for}</p>
      </div>

      <div className="bg-white p-6 space-y-4">
        {/* Code + share */}
        <div>
          <label className="text-[10px] uppercase tracking-wider font-bold brand-bronze">Your code</label>
          <div className="mt-1 flex gap-2">
            <div className="flex-1 px-3.5 h-12 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 flex items-center justify-between font-mono font-bold text-lg text-slate-900 tracking-wider" data-testid="ref-code">
              {data.code}
            </div>
            <Button onClick={() => copy(data.code)} variant="outline" className="rounded-xl h-12 px-3.5 border-amber-300" data-testid="ref-copy-code">
              {copied ? <CheckCircle2 className="h-4 w-4 brand-emerald" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Share URL */}
        <div>
          <label className="text-[10px] uppercase tracking-wider font-bold brand-bronze">Share link</label>
          <div className="mt-1 flex gap-2">
            <div className="flex-1 px-3.5 h-11 rounded-xl border border-slate-200 bg-slate-50 flex items-center text-[12.5px] text-slate-700 truncate" data-testid="ref-url">
              {data.share_url}
            </div>
            <Button onClick={share} className="btn-primary rounded-xl h-11 px-4 text-xs" data-testid="ref-share">
              <Share2 className="h-4 w-4 mr-1" /> Share
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Invites" value={data.invites} testid="ref-stat-invites" />
          <Stat label="Converted" value={data.converted} testid="ref-stat-converted" />
          <Stat label="Reward (AED)" value={earned.toFixed(0)} highlight testid="ref-stat-earned" />
        </div>

        {/* Available rewards */}
        {(earned > 0 || percent > 0) && (
          <div className="rounded-xl bg-[#F8F3E8] border border-amber-200 p-3.5" data-testid="ref-available">
            <div className="text-[10px] uppercase tracking-wider font-bold brand-bronze">Available rewards</div>
            <ul className="mt-2 space-y-1 text-[12.5px] text-slate-800">
              {earned > 0 && (
                <li className="flex items-center gap-2"><Coins className="h-3.5 w-3.5 brand-bronze" /> <b>AED {earned.toFixed(2)}</b> cashback (applied to your next invoice)</li>
              )}
              {percent > 0 && (
                <li className="flex items-center gap-2"><Percent className="h-3.5 w-3.5 brand-bronze" /> <b>{percent}% off</b> your next renewal</li>
              )}
            </ul>
          </div>
        )}

        {/* CTA */}
        <button
          type="button"
          onClick={share}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 text-white h-11 text-sm font-semibold hover:bg-emerald-800 transition-colors"
          data-testid="ref-cta"
        >
          <Sparkles className="h-4 w-4" /> Invite a founder friend <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight, testid }) {
  return (
    <div className={`rounded-xl p-3 border ${highlight ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`} data-testid={testid}>
      <div className={`font-display text-xl font-bold ${highlight ? 'brand-bronze' : 'text-slate-900'}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">{label}</div>
    </div>
  );
}
