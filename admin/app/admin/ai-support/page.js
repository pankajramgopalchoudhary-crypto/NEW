'use client';
import { useEffect, useState, useCallback } from 'react';
import { Sparkles, ShieldAlert, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react';

const CATEGORIES = ['general','technical','account','payment','visa','compliance','sales','foundersclub','other'];

async function api(path, opts = {}) {
  const r = await fetch(path, { credentials: 'include', ...opts });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.detail || `HTTP ${r.status}`);
  return j;
}

export default function AISupportPage() {
  const [cfg, setCfg] = useState(null);
  const [logs, setLogs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [c, l] = await Promise.all([
        api('/api/admin/ai-support/config'),
        api('/api/admin/ai-support/logs?limit=50'),
      ]);
      setCfg(c); setLogs(l.items || []);
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleCat = (cat, list) => {
    const set = new Set(cfg[list]);
    if (set.has(cat)) set.delete(cat); else set.add(cat);
    setCfg({ ...cfg, [list]: Array.from(set) });
  };

  const save = async () => {
    setBusy(true); setSaveMsg('');
    try {
      const updated = await api('/api/admin/ai-support/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: cfg.mode,
          confidence_threshold: Number(cfg.confidence_threshold),
          allowed_categories: cfg.allowed_categories,
          blocked_categories: cfg.blocked_categories,
        }),
      });
      setCfg(updated);
      setSaveMsg('Saved · ' + new Date().toLocaleTimeString());
    } catch (e) { setSaveMsg('Error: ' + e.message); }
    finally { setBusy(false); }
  };

  if (!cfg) return <div className="p-8 text-slate-500">Loading…</div>;

  const takeoverRate = logs.length
    ? Math.round(100 * logs.filter(l => l.action === 'escalated_high_risk' || l.requires_human).length / logs.length)
    : 0;

  return (
    <div className="p-6 space-y-6" data-testid="admin-ai-support">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 grid place-items-center">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">AI Support Agent</h1>
          <p className="text-sm text-slate-500">Aria's support brain. Default is <b>SUGGEST_ONLY</b> — auto-reply is off unless you explicitly enable it below.</p>
        </div>
        <button onClick={load} className="rounded-lg border border-slate-300 px-3 py-2 text-sm inline-flex items-center gap-1.5" data-testid="ai-refresh">
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Mode toggle */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4" data-testid="ai-config">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {['DISABLED', 'SUGGEST_ONLY', 'AUTO_REPLY'].map((m) => {
            const active = cfg.mode === m;
            const border = active ? (m === 'AUTO_REPLY' ? 'border-purple-500 bg-purple-50' : 'border-emerald-500 bg-emerald-50') : 'border-slate-200';
            return (
              <button
                key={m}
                onClick={() => setCfg({ ...cfg, mode: m })}
                className={`rounded-xl border-2 px-4 py-3 text-left transition-colors ${border}`}
                data-testid={`ai-mode-${m}`}
              >
                <div className="text-sm font-bold text-slate-900">{m.replace('_', ' ')}</div>
                <div className="text-[12px] text-slate-500 mt-1">
                  {m === 'DISABLED' && 'AI never runs. Every ticket goes to a human agent.'}
                  {m === 'SUGGEST_ONLY' && '(default) Aria drafts a reply for the agent to review; nothing is sent automatically.'}
                  {m === 'AUTO_REPLY' && 'Aria replies automatically when confidence + category + risk gates pass.'}
                </div>
              </button>
            );
          })}
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">Confidence threshold: {(cfg.confidence_threshold * 100).toFixed(0)}%</label>
          <input
            type="range" min={0.5} max={1.0} step={0.05}
            value={cfg.confidence_threshold}
            onChange={(e) => setCfg({ ...cfg, confidence_threshold: parseFloat(e.target.value) })}
            className="w-full mt-2 accent-emerald-600"
            data-testid="ai-confidence"
          />
          <p className="text-[12px] text-slate-500 mt-1">Auto-reply is only sent when Aria's self-reported confidence meets or exceeds this bar. Default 90%.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">Allowed categories (auto-reply)</div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const on = cfg.allowed_categories?.includes(c);
                return (
                  <button key={c} onClick={() => toggleCat(c, 'allowed_categories')} className={`rounded-full px-3 py-1 text-[12px] border ${on ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300'}`} data-testid={`ai-allow-${c}`}>{c}</button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">Blocked categories (never auto-reply)</div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const on = cfg.blocked_categories?.includes(c);
                return (
                  <button key={c} onClick={() => toggleCat(c, 'blocked_categories')} className={`rounded-full px-3 py-1 text-[12px] border ${on ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-300'}`} data-testid={`ai-block-${c}`}>{c}</button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button onClick={save} disabled={busy} className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm" data-testid="ai-save">
            {busy ? 'Saving…' : 'Save configuration'}
          </button>
          {saveMsg && <span className="text-[12px] text-slate-600">{saveMsg}</span>}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">Suggestions (last {logs.length})</div>
          <div className="text-2xl font-bold">{logs.length}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">High-risk escalations</div>
          <div className="text-2xl font-bold text-rose-600">
            {logs.filter(l => l.action === 'escalated_high_risk').length}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">Human takeover rate</div>
          <div className="text-2xl font-bold text-amber-700">{takeoverRate}%</div>
        </div>
      </div>

      {/* Recent AI activity */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden" data-testid="ai-logs">
        <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold text-slate-900">Recent AI activity</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Ticket</th>
                <th className="text-left px-3 py-2">Category</th>
                <th className="text-left px-3 py-2">Intent</th>
                <th className="text-left px-3 py-2">Confidence</th>
                <th className="text-left px-3 py-2">Action</th>
                <th className="text-left px-3 py-2">Human</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-[11px]">{l.ticket_id?.slice(0, 8)}</td>
                  <td className="px-3 py-2">{l.category}</td>
                  <td className="px-3 py-2 text-slate-500">{l.intent}</td>
                  <td className="px-3 py-2">{l.confidence?.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ${
                      l.action?.includes('escalated') ? 'bg-rose-100 text-rose-700' :
                      l.action === 'auto_reply_eligible' ? 'bg-purple-100 text-purple-700' :
                      l.action === 'suggested' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {(l.action || '').replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {l.requires_human ? <ShieldAlert className="h-4 w-4 text-rose-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-slate-400">No AI activity yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 p-4 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5" />
        <div className="text-[13px]">
          <div className="font-semibold">Auto-reply safeguards (cannot be disabled)</div>
          <ul className="list-disc ml-5 mt-1 space-y-0.5">
            <li>Refund / complaint / legal / visa-denial / payment-dispute keywords → auto-escalate to human</li>
            <li>Never returns pricing, refund amounts, or policy commitments</li>
            <li>Internal notes and other customers' details are never exposed</li>
            <li>Every suggestion is logged in <code>ai_support_logs</code> for audit</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
