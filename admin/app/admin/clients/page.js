'use client';
import { useEffect, useState } from 'react';
import { Search, Download, MessageCircle } from 'lucide-react';

export default function ClientsPage() {
  const [data, setData] = useState({ clients: [], total_clients: 0, paid_orders: 0, pre_bookings: 0 });
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/clients', { credentials: 'include' })
      .then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  const zones = ['all', ...Array.from(new Set(data.clients.map(c => c.zone).filter(Boolean)))];
  const filtered = data.clients.filter(c => {
    const s = search.toLowerCase();
    if (s && !((c.name || '').toLowerCase().includes(s) || (c.email || '').toLowerCase().includes(s) || (c.phone || '').includes(s))) return false;
    if (zoneFilter !== 'all' && c.zone !== zoneFilter) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-2xl font-bold text-slate-900">Clients</div>
          <div className="text-sm text-slate-500">{filtered.length} clients</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200"><div className="text-xs text-slate-500">Total Clients</div><div className="text-2xl font-bold">{data.total_clients}</div></div>
        <div className="bg-white p-4 rounded-xl border border-slate-200"><div className="text-xs text-slate-500">Paid Orders</div><div className="text-2xl font-bold text-emerald-700">{data.paid_orders}</div></div>
        <div className="bg-white p-4 rounded-xl border border-slate-200"><div className="text-xs text-slate-500">Pre-Bookings</div><div className="text-2xl font-bold text-amber-600">{data.pre_bookings}</div></div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-3 mb-3 flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <select value={zoneFilter} onChange={e => setZoneFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          {zones.map(z => <option key={z} value={z}>{z === 'all' ? 'All zones' : z}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
          <option value="all">All statuses</option>
          <option value="new">New</option>
          <option value="qualified">Qualified</option>
          <option value="prebook">Pre-Book</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5">Client</th>
              <th className="text-left px-4 py-2.5">Contact</th>
              <th className="text-left px-4 py-2.5">Zone</th>
              <th className="text-left px-4 py-2.5">Applications</th>
              <th className="text-left px-4 py-2.5">Value (AED)</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-left px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={7} className="text-center py-8 text-slate-400">Loading…</td></tr>}
            {filtered.map(c => (
              <tr key={c.key} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-semibold">{c.name || '—'}</td>
                <td className="px-4 py-2.5 text-xs"><div>{c.email}</div><div className="text-slate-400">{c.phone}</div></td>
                <td className="px-4 py-2.5">{c.zone || '—'}</td>
                <td className="px-4 py-2.5">{c.applications}</td>
                <td className="px-4 py-2.5">{Number(c.total_value || 0).toLocaleString()}</td>
                <td className="px-4 py-2.5"><span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100">{c.status}</span></td>
                <td className="px-4 py-2.5">
                  {c.phone && <a href={`https://wa.me/${c.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-emerald-600 inline-flex items-center gap-1 text-xs hover:underline"><MessageCircle className="w-3 h-3" /> WA</a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
