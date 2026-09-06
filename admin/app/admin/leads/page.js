'use client';
import { useEffect, useState } from 'react';
import { Download, Search } from 'lucide-react';

const STATUSES = ['all', 'new', 'contacted', 'qualified', 'won', 'lost', 'paid'];
const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-amber-100 text-amber-700',
  qualified: 'bg-purple-100 text-purple-700',
  won: 'bg-emerald-100 text-emerald-700',
  paid: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-rose-100 text-rose-700',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLeads = async (s = filter) => {
    setLoading(true);
    const url = s === 'all' ? '/api/admin/leads' : `/api/admin/leads?status=${s}`;
    const r = await fetch(url, { credentials: 'include' });
    const d = await r.json();
    setLeads(d.leads || []);
    setLoading(false);
  };

  useEffect(() => { fetchLeads('all'); }, []);

  const updateStatus = async (id, status) => {
    await fetch(`/api/admin/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    fetchLeads(filter);
  };

  const filtered = leads.filter(l => {
    const s = search.toLowerCase();
    if (!s) return true;
    return (l.name || '').toLowerCase().includes(s) || (l.email || '').toLowerCase().includes(s) || (l.phone || '').includes(s);
  });

  const exportCsv = () => {
    const rows = [['Name', 'Email', 'Phone', 'Zone', 'Status', 'Source', 'Created']];
    filtered.forEach(l => rows.push([l.name, l.email, l.phone, l.zone, l.status, l.source, l.created_at]));
    const csv = rows.map(r => r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-2xl font-bold text-slate-900">Leads & Orders</div>
          <div className="text-sm text-slate-500">{filtered.length} of {leads.length} records</div>
        </div>
        <button onClick={exportCsv} className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-2 rounded-lg flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, phone"
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="flex gap-1">
            {STATUSES.map(s => (
              <button key={s} onClick={() => { setFilter(s); fetchLeads(s); }}
                className={`px-3 py-1.5 text-xs rounded-md font-semibold capitalize ${filter === s ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5">Name</th>
              <th className="text-left px-4 py-2.5">Contact</th>
              <th className="text-left px-4 py-2.5">Zone</th>
              <th className="text-left px-4 py-2.5">Source</th>
              <th className="text-left px-4 py-2.5">Created</th>
              <th className="text-left px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={6} className="text-center py-8 text-slate-400">Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">No leads found</td></tr>}
            {filtered.map(l => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-semibold text-slate-900">{l.name || '—'}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  <div>{l.email || '—'}</div>
                  <div className="text-xs text-slate-400">{l.phone || ''}</div>
                </td>
                <td className="px-4 py-2.5 text-slate-700">{l.zone || 'Consultation'}</td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">{l.source || '—'}</td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">{l.created_at ? new Date(l.created_at).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-2.5">
                  <select value={l.status || 'new'} onChange={(e) => updateStatus(l.id, e.target.value)}
                    className={`px-2 py-1 text-[10px] font-bold uppercase rounded border-0 ${STATUS_COLORS[l.status] || 'bg-slate-100 text-slate-700'}`}>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="qualified">Qualified</option>
                    <option value="won">Won</option>
                    <option value="paid">Paid</option>
                    <option value="lost">Lost</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
