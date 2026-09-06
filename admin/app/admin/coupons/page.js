'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

export default function CouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ code: '', discount_type: 'pct', discount_value: 10, usage_limit: 100, description: '', is_active: true });

  const load = async () => {
    const r = await fetch('/api/admin/coupons', { credentials: 'include' });
    const d = await r.json();
    setCoupons(d.coupons || []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    await fetch('/api/admin/coupons', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setCreating(false);
    setForm({ code: '', discount_type: 'pct', discount_value: 10, usage_limit: 100, description: '', is_active: true });
    load();
  };
  const toggle = async (code, current) => {
    await fetch(`/api/admin/coupons/${encodeURIComponent(code)}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !current }) });
    load();
  };
  const del = async (code) => {
    await fetch(`/api/admin/coupons/${encodeURIComponent(code)}`, { method: 'DELETE', credentials: 'include' });
    load();
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div><div className="text-2xl font-bold text-slate-900">Coupons</div><div className="text-sm text-slate-500">{coupons.length} codes</div></div>
        <button onClick={() => setCreating(!creating)} className="text-xs bg-emerald-700 text-white px-3 py-2 rounded-lg flex items-center gap-1.5"><Plus className="w-3 h-3" /> New Coupon</button>
      </div>
      {creating && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-4 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
          <div><label className="text-[10px] uppercase font-bold text-slate-500">Code</label><input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
          <div><label className="text-[10px] uppercase font-bold text-slate-500">Type</label><select value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value })} className="w-full px-2 py-1.5 border rounded text-sm"><option value="pct">% off</option><option value="fixed">AED off</option></select></div>
          <div><label className="text-[10px] uppercase font-bold text-slate-500">Value</label><input type="number" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: Number(e.target.value) })} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
          <div><label className="text-[10px] uppercase font-bold text-slate-500">Limit</label><input type="number" value={form.usage_limit} onChange={e => setForm({ ...form, usage_limit: Number(e.target.value) })} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
          <button onClick={create} className="bg-emerald-700 text-white py-1.5 rounded text-xs font-semibold">Create</button>
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="text-left px-4 py-2.5">Code</th><th className="text-left px-4 py-2.5">Discount</th><th className="text-left px-4 py-2.5">Usage</th><th className="text-left px-4 py-2.5">Description</th><th className="text-left px-4 py-2.5">Status</th><th className="text-left px-4 py-2.5">Action</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {coupons.map(c => (
              <tr key={c.code} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-mono font-bold text-emerald-700">{c.code}</td>
                <td className="px-4 py-2.5">{c.discount_type === 'pct' ? `${c.discount_value}%` : `AED ${c.discount_value}`}</td>
                <td className="px-4 py-2.5 text-xs">{c.used_count || 0} / {c.usage_limit || '∞'}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{c.description || '—'}</td>
                <td className="px-4 py-2.5"><button onClick={() => toggle(c.code, c.is_active)} className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${c.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{c.is_active ? 'Active' : 'Inactive'}</button></td>
                <td className="px-4 py-2.5"><button onClick={() => del(c.code)} className="text-rose-500 text-xs hover:bg-rose-50 px-2 py-1 rounded inline-flex items-center gap-1"><Trash2 className="w-3 h-3" /> Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
