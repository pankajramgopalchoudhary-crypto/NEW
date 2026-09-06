'use client';
import { useEffect, useState, useCallback } from 'react';
import { Mail, RefreshCw, Send, ChevronDown, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function StatCard({ label, value, tone = 'slate', testid }) {
  const toneClass = {
    slate: 'text-slate-900',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    rose: 'text-rose-700',
    blue: 'text-blue-700',
  }[tone];
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4" data-testid={testid}>
      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1.5">{label}</div>
      <div className={`text-2xl font-bold ${toneClass}`}>{value ?? 0}</div>
    </div>
  );
}

function StatusPill({ status }) {
  const tones = {
    queued: 'bg-slate-100 text-slate-700',
    sent: 'bg-blue-100 text-blue-700',
    delivered: 'bg-emerald-100 text-emerald-700',
    delivery_delayed: 'bg-amber-100 text-amber-700',
    bounced: 'bg-rose-100 text-rose-700',
    failed: 'bg-rose-100 text-rose-800',
    complained: 'bg-purple-100 text-purple-700',
    opened: 'bg-teal-100 text-teal-700',
    clicked: 'bg-indigo-100 text-indigo-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ${tones[status] || tones.queued}`}>
      {status?.replace('_', ' ') || '—'}
    </span>
  );
}

async function api(path, opts = {}) {
  const url = `${API_BASE || ''}${path}`;
  const r = await fetch(url, { credentials: 'include', ...opts });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.detail || `HTTP ${r.status}`);
  return j;
}

export default function EmailHealthPage() {
  const [stats, setStats] = useState({});
  const [days, setDays] = useState(7);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState({ status: '', from_alias: '', q: '' });

  const [test, setTest] = useState({ open: false, alias: 'noreply', to: '', busy: false, result: '' });

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [s, l] = await Promise.all([
        api(`/api/admin/email-logs/stats?days=${days}`),
        api(`/api/admin/email-logs?limit=50&status=${encodeURIComponent(filter.status)}&from_alias=${encodeURIComponent(filter.from_alias)}&q=${encodeURIComponent(filter.q)}`),
      ]);
      setStats(s);
      setItems(l.items || []);
    } catch (e) {
      console.error('[email-health] load', e);
    } finally { setBusy(false); }
  }, [days, filter.status, filter.from_alias, filter.q]);

  useEffect(() => { load(); }, [load]);

  const sendTest = async () => {
    if (!test.to) return;
    setTest(t => ({ ...t, busy: true, result: '' }));
    try {
      const res = await api('/api/notify/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: test.to,
          from_alias: test.alias,
          subject: `Test email from ${test.alias}@smartsetupuae.ae`,
          html: `<p>This is a test email from the SmartSetupUAE admin panel.</p><p>Sender alias: <b>${test.alias}</b></p>`,
          event_type: 'test',
        }),
      });
      setTest(t => ({ ...t, busy: false, result: res.ok ? `Sent · Resend id: ${res.id || res.log_id}` : `Failed: ${res.error || 'unknown'}` }));
      load();
    } catch (e) {
      setTest(t => ({ ...t, busy: false, result: `Error: ${e.message}` }));
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="admin-email-health">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 grid place-items-center">
          <Mail className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Email Health</h1>
          <p className="text-sm text-slate-500">Live Resend delivery status for every transactional email (last {days} days)</p>
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" data-testid="email-health-days">
          {[1, 7, 14, 30, 90].map((d) => <option key={d} value={d}>Last {d}d</option>)}
        </select>
        <button onClick={load} className="rounded-lg border border-slate-300 px-3 py-2 text-sm inline-flex items-center gap-1.5" data-testid="email-health-refresh">
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Refresh
        </button>
        <button onClick={() => setTest(t => ({ ...t, open: !t.open }))} className="rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm inline-flex items-center gap-1.5" data-testid="email-health-test-toggle">
          <Send className="h-4 w-4" /> Send test email
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <StatCard label="Total" value={stats.total} testid="stat-total" />
        <StatCard label="Sent" value={stats.sent} tone="blue" testid="stat-sent" />
        <StatCard label="Delivered" value={stats.delivered} tone="emerald" testid="stat-delivered" />
        <StatCard label="Delayed" value={stats.delivery_delayed} tone="amber" testid="stat-delayed" />
        <StatCard label="Bounced" value={stats.bounced} tone="rose" testid="stat-bounced" />
        <StatCard label="Failed" value={stats.failed} tone="rose" testid="stat-failed" />
        <StatCard label="Complaints" value={stats.complained} tone="rose" testid="stat-complained" />
        <StatCard label="Opened" value={stats.opened} tone="emerald" testid="stat-opened" />
        <StatCard label="Clicked" value={stats.clicked} tone="emerald" testid="stat-clicked" />
        <StatCard label="Queued" value={stats.queued} testid="stat-queued" />
      </div>

      {test.open && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3" data-testid="email-health-test">
          <div className="text-sm font-semibold text-slate-900">Send a test email</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select value={test.alias} onChange={(e) => setTest(t => ({ ...t, alias: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" data-testid="email-test-alias">
              {['noreply','account','support','sales','visa','compliance','foundersclub','careers'].map(a => <option key={a} value={a}>{a}@smartsetupuae.ae</option>)}
            </select>
            <input value={test.to} onChange={(e) => setTest(t => ({ ...t, to: e.target.value }))} placeholder="destination@example.com" className="md:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm" data-testid="email-test-to" />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={sendTest} disabled={test.busy || !test.to} className="rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm disabled:opacity-50" data-testid="email-test-send">
              {test.busy ? 'Sending…' : 'Send'}
            </button>
            {test.result && <span className="text-[13px] text-slate-700">{test.result}</span>}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden" data-testid="email-health-log">
        <div className="p-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <input placeholder="Search recipient / subject" value={filter.q} onChange={(e) => setFilter(f => ({ ...f, q: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm w-64" data-testid="email-filter-q" />
          <select value={filter.status} onChange={(e) => setFilter(f => ({ ...f, status: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" data-testid="email-filter-status">
            <option value="">Any status</option>
            {['queued','sent','delivered','delivery_delayed','bounced','failed','complained','opened','clicked'].map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filter.from_alias} onChange={(e) => setFilter(f => ({ ...f, from_alias: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" data-testid="email-filter-alias">
            <option value="">Any sender</option>
            {['noreply','account','support','sales','visa','compliance','foundersclub','careers'].map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Recipient</th>
                <th className="text-left px-3 py-2">Sender</th>
                <th className="text-left px-3 py-2">Event</th>
                <th className="text-left px-3 py-2">Subject</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Provider ID</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{e.to}</td>
                  <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{e.from_alias}</td>
                  <td className="px-3 py-2 text-slate-500">{e.event_type}</td>
                  <td className="px-3 py-2 truncate max-w-[280px]" title={e.subject}>{e.subject}</td>
                  <td className="px-3 py-2"><StatusPill status={e.status} /></td>
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-500 truncate max-w-[160px]" title={e.provider_message_id}>{e.provider_message_id || '—'}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-slate-400">No emails match your filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
