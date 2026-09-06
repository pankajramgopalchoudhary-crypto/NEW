'use client';
import { useEffect, useState } from 'react';
import { TrendingUp, Users, DollarSign, FileCheck } from 'lucide-react';

export default function AnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [zones, setZones] = useState([]);
  const [activities, setActivities] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/stats/overview', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/stats/by-zone', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/admin/stats/activities-count', { credentials: 'include' }).then(r => r.json()),
    ]).then(([s, z, a]) => { setStats(s); setZones(z.zones || []); setActivities(a); });
  }, []);

  if (!stats) return <div className="p-8 text-emerald-700">Loading…</div>;

  const conversionRate = stats.total_leads > 0 ? ((stats.paid_orders / stats.total_leads) * 100).toFixed(1) : 0;
  const avgOrderValue = stats.paid_orders > 0 ? Math.round(stats.revenue_paid / stats.paid_orders) : 0;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="mb-5"><div className="text-2xl font-bold text-slate-900">Analytics</div><div className="text-sm text-slate-500">Business insights from live Supabase data</div></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
        <Stat icon={Users} label="Total Leads" value={stats.total_leads} color="text-blue-600" />
        <Stat icon={TrendingUp} label="Conversion %" value={`${conversionRate}%`} color="text-emerald-600" />
        <Stat icon={DollarSign} label="Total Revenue" value={`AED ${(stats.revenue_paid + stats.revenue_prebook).toLocaleString()}`} color="text-amber-600" />
        <Stat icon={FileCheck} label="Avg Order" value={`AED ${avgOrderValue.toLocaleString()}`} color="text-purple-600" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-sm font-bold mb-3">Activities Database</div>
          {activities ? (
            <>
              <div className="text-3xl font-bold text-emerald-700">{activities.total.toLocaleString()}</div>
              <div className="text-xs text-slate-500 mt-1">Total activities in master DB · {activities.active.toLocaleString()} active on website</div>
              {activities.total > activities.active && (
                <div className="mt-3 text-xs bg-amber-50 border border-amber-200 rounded p-2 text-amber-800">⚠️ {activities.total - activities.active} activities inactive. Public website AI search will not show these.</div>
              )}
            </>
          ) : <div className="text-slate-400">Loading…</div>}
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="text-sm font-bold mb-3">Leads by Zone</div>
          <div className="space-y-2">
            {zones.slice(0, 10).map((z, i) => (
              <div key={z.zone}>
                <div className="flex justify-between text-xs mb-1"><span className="font-semibold">{z.zone}</span><span>{z.count}</span></div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-600" style={{ width: `${(z.count / zones[0].count) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <Icon className={`w-5 h-5 mb-2 ${color}`} />
      <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
