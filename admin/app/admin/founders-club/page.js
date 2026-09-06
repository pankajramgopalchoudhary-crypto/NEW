'use client';
import { useEffect, useState } from 'react';
import { Crown, Plus } from 'lucide-react';

export default function FoundersClubPage() {
  const [data, setData] = useState({ members: [], free_used: 0, paid_used: 0, free_limit: 500, paid_limit: 500 });
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', tier: 'free' });

  const load = async () => {
    const r = await fetch('/api/admin/founders-club', { credentials: 'include' });
    const d = await r.json();
    setData(d);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    await fetch('/api/admin/founders-club', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setCreating(false);
    setForm({ full_name: '', email: '', phone: '', tier: 'free' });
    load();
  };
  const toggle = async (id, current) => {
    await fetch(`/api/admin/founders-club/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !current }) });
    load();
  };

  const pctFree = Math.min(100, (data.free_used / data.free_limit) * 100);
  const pctPaid = Math.min(100, (data.paid_used / data.paid_limit) * 100);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Crown className="w-7 h-7 text-amber-500" />
          <div><div className="text-2xl font-bold text-slate-900">Founders Club</div><div className="text-sm text-slate-500">Manage Free Advisory (first 500) and Founders Club Membership (limited 500)</div></div>
        </div>
        <button onClick={() => setCreating(!creating)} className="text-xs bg-emerald-700 text-white px-3 py-2 rounded-lg flex items-center gap-1.5"><Plus className="w-3 h-3" /> Add Member</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <div className="bg-white border border-emerald-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3"><div className="text-sm font-bold text-emerald-900">Free Advisory (first 500 founders)</div><div className="text-2xl font-bold">{data.free_used} <span className="text-sm text-slate-400">/ {data.free_limit}</span></div></div>
          <div className="w-full h-3 bg-emerald-50 rounded-full overflow-hidden"><div className="h-full bg-emerald-600 transition-all" style={{ width: `${pctFree}%` }} /></div>
          <div className="text-xs text-slate-500 mt-2">{Math.round(pctFree)}% used · {data.free_limit - data.free_used} slots remaining</div>
        </div>
        <div className="bg-white border border-amber-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3"><div className="text-sm font-bold text-amber-900">Founders Club Membership</div><div className="text-2xl font-bold">{data.paid_used} <span className="text-sm text-slate-400">/ {data.paid_limit}</span></div></div>
          <div className="w-full h-3 bg-amber-50 rounded-full overflow-hidden"><div className="h-full bg-amber-500 transition-all" style={{ width: `${pctPaid}%` }} /></div>
          <div className="text-xs text-slate-500 mt-2">{Math.round(pctPaid)}% used · {data.paid_limit - data.paid_used} slots remaining</div>
        </div>
      </div>

      {creating && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
          <input placeholder="Full name" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="px-2 py-1.5 border rounded text-sm" />
          <input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="px-2 py-1.5 border rounded text-sm" />
          <input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="px-2 py-1.5 border rounded text-sm" />
          <select value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })} className="px-2 py-1.5 border rounded text-sm"><option value="free">Free Advisory</option><option value="paid">Founders Club</option></select>
          <button onClick={create} className="bg-amber-500 text-white py-1.5 rounded text-xs font-semibold">Add</button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="text-left px-4 py-2.5">Name</th><th className="text-left px-4 py-2.5">Email</th><th className="text-left px-4 py-2.5">Phone</th><th className="text-left px-4 py-2.5">Tier</th><th className="text-left px-4 py-2.5">Joined</th><th className="text-left px-4 py-2.5">Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data.members.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">No members yet. Add the first one above!</td></tr>}
            {data.members.map(m => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-semibold">{m.full_name || m.name}</td>
                <td className="px-4 py-2.5 text-xs">{m.email}</td>
                <td className="px-4 py-2.5 text-xs">{m.phone || '—'}</td>
                <td className="px-4 py-2.5"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${m.tier === 'paid' || m.tier === 'founder_paid' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{m.tier}</span></td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-2.5"><button onClick={() => toggle(m.id, m.is_active !== false)} className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${m.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{m.is_active !== false ? 'Active' : 'Inactive'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
