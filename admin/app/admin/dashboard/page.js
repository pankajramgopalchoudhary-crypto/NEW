'use client';
import { useEffect, useState } from 'react';
import { Crown, TrendingUp, RefreshCw } from 'lucide-react';

function StatCard({ label, value, sub, color, testid }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 relative overflow-hidden" data-testid={testid}>
      <div className={`absolute top-0 left-0 right-0 h-1 ${color}`} />
      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">{label}</div>
      <div className="text-3xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{sub}</div>
    </div>
  );
}

function FoundersBar({ label, used, limit, color }) {
  const pct = Math.min(100, (used / limit) * 100);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Crown className={`w-4 h-4 ${color === 'amber' ? 'text-amber-500' : 'text-emerald-600'}`} />
          <div className="text-sm font-semibold text-slate-900">{label}</div>
        </div>
        <div className="text-2xl font-bold text-slate-900">{used} <span className="text-sm font-normal text-slate-400">/ {limit}</span></div>
      </div>
      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color === 'amber' ? 'bg-amber-500' : 'bg-emerald-600'} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-slate-500 mt-2">{Math.round(pct)}% used · {limit - used} slots remaining</div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [zones, setZones] = useState([]);
  const [pipeline, setPipeline] = useState({});
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    const [s, l, z, p, m] = await Promise.all([
      fetch('/api/admin/stats/overview', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/leads?limit=6', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/stats/by-zone', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/stats/pipeline', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/auth/me', { credentials: 'include' }).then(r => r.json()).catch(() => null),
    ]);
    setStats(s);
    setRecent(l.leads || []);
    setZones(z.zones || []);
    setPipeline(p.pipeline || {});
    setUser(m?.user || null);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  if (loading) return <div className="p-8 text-emerald-700">Loading dashboard…</div>;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const maxZone = Math.max(...zones.map(z => z.count), 1);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="text-2xl font-bold text-slate-900">Dashboard</div>
          <div className="text-sm text-slate-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
        <button onClick={fetchAll} className="text-xs text-emerald-700 hover:text-emerald-900 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Greeting banner */}
      <div className="bg-gradient-to-r from-[#0A3D34] to-[#062A24] rounded-2xl p-6 mb-5 text-white relative overflow-hidden">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xl font-bold">{greeting}, {user?.name || 'Founder'} 👋</div>
            <div className="text-sm text-[#D4AF37] mt-1 tracking-[0.2em] font-medium">SETUP SMART. GROW FAST.</div>
            <div className="text-xs text-white/60 mt-1">Axiscrest Global FZE LLC · Lic: 262843696888</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-white/70 font-bold">Today's Slots</div>
            <div className="text-4xl font-bold text-[#D4AF37]">{Math.max(0, 5 - (stats?.docs_pending || 0))}</div>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard testid="kpi-leads" label="Total Leads" value={stats?.total_leads ?? 0} sub="All enquiries" color="bg-blue-500" />
        <StatCard testid="kpi-prebookings" label="Pre-Bookings" value={stats?.prebookings ?? 0} sub={`AED ${(stats?.revenue_prebook || 0).toLocaleString()} collected`} color="bg-amber-500" />
        <StatCard testid="kpi-orders" label="Paid Orders" value={stats?.paid_orders ?? 0} sub={`AED ${(stats?.revenue_paid || 0).toLocaleString()} revenue`} color="bg-emerald-500" />
        <StatCard testid="kpi-docs" label="Docs Pending" value={stats?.docs_pending ?? 0} sub="Awaiting review" color="bg-rose-500" />
      </div>

      {/* Founders Club live counters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <FoundersBar label="Free Advisory (first 500 founders)" used={stats?.founder_free_used || 0} limit={stats?.founder_free_limit || 500} color="emerald" />
        <FoundersBar label="Founders Club Membership" used={stats?.founder_paid_used || 0} limit={stats?.founder_paid_limit || 500} color="amber" />
      </div>

      {/* Recent Leads + Zones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-slate-900">Recent Leads</div>
            <a href="/admin/leads" className="text-xs text-emerald-700 font-semibold">View all →</a>
          </div>
          <div className="divide-y divide-slate-100">
            {recent.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">No leads yet</div>}
            {recent.map(l => (
              <div key={l.id} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <div className="font-semibold text-slate-900">{l.name || 'Unknown'}</div>
                  <div className="text-xs text-slate-500">{l.phone || l.email || '—'}</div>
                </div>
                <div className="text-xs text-slate-600">{l.zone || 'Consultation'}</div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${l.status === 'paid' || l.status === 'won' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{l.status || 'new'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-sm font-bold text-slate-900 mb-3">Leads by Zone</div>
          <div className="space-y-2.5">
            {zones.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">No data</div>}
            {zones.map((z, i) => {
              const colors = ['bg-emerald-600', 'bg-amber-500', 'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-rose-500', 'bg-cyan-500'];
              return (
                <div key={z.zone}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-700">{z.zone}</span>
                    <span className="text-slate-500">{z.count}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${colors[i % colors.length]}`} style={{ width: `${(z.count / maxZone) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pipeline */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mt-4">
        <div className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-600" /> Client Pipeline</div>
        <div className="grid grid-cols-5 gap-3">
          {[
            { key: 'new', label: 'New', color: 'text-slate-700' },
            { key: 'contacted', label: 'Contacted', color: 'text-amber-600' },
            { key: 'qualified', label: 'Qualified', color: 'text-blue-600' },
            { key: 'won', label: 'Won', color: 'text-emerald-600' },
            { key: 'lost', label: 'Lost', color: 'text-rose-500' },
          ].map(c => (
            <div key={c.key} className="text-center p-3 bg-slate-50 rounded-lg">
              <div className={`text-3xl font-bold ${c.color}`}>{pipeline[c.key] || 0}</div>
              <div className="text-xs text-slate-500 mt-1">{c.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
