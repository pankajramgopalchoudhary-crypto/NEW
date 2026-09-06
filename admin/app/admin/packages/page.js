'use client';
import { useEffect, useState } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';

const FREEZONES = ['ANCFZ', 'SPC', 'RAKEZ', 'IFZA', 'Meydan', 'SHAMS', 'DMCC', 'JAFZA', 'KIZAD', 'DAFZA'];

export default function PackagesPage() {
  const [zone, setZone] = useState('ANCFZ');
  const [packages, setPackages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async (z = zone) => {
    const r = await fetch(`/api/admin/freezone/${encodeURIComponent(z)}`, { credentials: 'include' });
    const d = await r.json();
    setPackages(d.packages || []);
  };
  useEffect(() => { load(zone); }, [zone]);

  const update = (idx, field, value) => {
    setPackages(prev => prev.map((p, i) => i === idx ? { ...p, [field]: ['base_price', 'visa_count', 'duration_years', 'shareholder_count'].includes(field) ? Number(value) : value } : p));
  };

  const addPackage = () => {
    setPackages(prev => [...prev, { package_name: 'New Package', package_type: 'license', duration_years: 1, visa_count: 0, shareholder_count: 1, base_price: 0, currency: 'AED', notes: '', is_active: true }]);
  };

  const deletePackage = async (idx) => {
    const p = packages[idx];
    if (p.id) await fetch(`/api/admin/packages/${p.id}`, { method: 'DELETE', credentials: 'include' });
    setPackages(prev => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setSaving(true); setMsg('');
    const r = await fetch(`/api/admin/freezone/${encodeURIComponent(zone)}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ packages }) });
    const d = await r.json();
    if (d.ok) { setMsg(`✓ Saved ${zone} · live on website`); load(zone); } else setMsg(d.error || 'Save failed');
    setSaving(false);
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-2xl font-bold text-slate-900">📦 Package & Pricing Manager</div>
          <div className="text-sm text-slate-500">All changes update website instantly</div>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-xs ${msg.startsWith('✓') ? 'text-emerald-700' : 'text-rose-600'}`}>{msg}</span>}
          <button onClick={save} disabled={saving} className="text-xs bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 disabled:opacity-50"><Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save All Changes →'}</button>
        </div>
      </div>

      <div className="mb-3 text-xs text-slate-500 font-semibold">Select Free Zone to Edit:</div>
      <div className="flex gap-1 flex-wrap mb-4">
        {FREEZONES.map(z => (
          <button key={z} onClick={() => setZone(z)} data-testid={`zone-tab-${z}`} className={`px-3 py-1.5 text-xs rounded-lg font-semibold ${zone === z ? 'bg-emerald-700 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}>{z}</button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-bold text-slate-900">{zone} — Package Editor</div>
          <button onClick={addPackage} className="text-xs border border-emerald-200 text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Plus className="w-3 h-3" /> Add Package Tier</button>
        </div>

        {packages.length === 0 && <div className="text-center py-12 text-slate-400 text-sm">No packages yet. Click “Add Package Tier” to create one.</div>}

        <div className="space-y-4">
          {packages.map((p, i) => (
            <div key={p.id || `new-${i}`} className="border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold text-emerald-700">Package {i + 1}: {p.package_name || 'Untitled'}</div>
                <button onClick={() => deletePackage(i)} className="text-xs text-rose-600 hover:bg-rose-50 px-2 py-1 rounded flex items-center gap-1"><Trash2 className="w-3 h-3" /> Delete</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Package Name" value={p.package_name} onChange={v => update(i, 'package_name', v)} />
                <Field label="Price (AED)" type="number" value={p.base_price} onChange={v => update(i, 'base_price', v)} />
                <Field label="Visas Included" type="number" value={p.visa_count} onChange={v => update(i, 'visa_count', v)} />
                <Field label="Duration (years)" type="number" value={p.duration_years} onChange={v => update(i, 'duration_years', v)} />
                <Field label="Shareholders" type="number" value={p.shareholder_count} onChange={v => update(i, 'shareholder_count', v)} />
                <Field label="Type" value={p.package_type} onChange={v => update(i, 'package_type', v)} />
              </div>
              <div className="mt-3">
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Notes / Description</label>
                <textarea value={p.notes || ''} onChange={e => update(i, 'notes', e.target.value)} rows={2} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={p.is_active !== false} onChange={e => update(i, 'is_active', e.target.checked)} />
                  Active on website
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</label>
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
    </div>
  );
}
