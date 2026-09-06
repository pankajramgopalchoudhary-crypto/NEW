'use client';
import { useEffect, useState } from 'react';
import { Plus, Save, Ban } from 'lucide-react';

const BILLING = ['one-time', 'monthly', 'per-filing', 'annual'];
const EMPTY = { slug: '', name: '', category: 'accounting', price_aed: 1000, billing: 'one-time', price_label: '', description: '', features: '', sort_order: 100 };

export default function ServiceCatalogPage() {
  const [services, setServices] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [drafts, setDrafts] = useState({});
  const [msg, setMsg] = useState('');

  const load = async () => {
    const r = await fetch('/api/admin/services', { credentials: 'include' });
    const d = await r.json();
    setServices(d.services || []);
    setDrafts({});
  };
  useEffect(() => { load(); }, []);

  const setDraft = (slug, patch) => setDrafts((p) => ({ ...p, [slug]: { ...(p[slug] || {}), ...patch } }));

  const save = async (slug) => {
    const patch = drafts[slug];
    if (!patch) return;
    const r = await fetch(`/api/admin/services/${encodeURIComponent(slug)}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    });
    const d = await r.json();
    setMsg(r.ok ? `Saved ${slug}` : d.error || 'Save failed');
    load();
  };

  const create = async () => {
    const r = await fetch('/api/admin/services', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const d = await r.json();
    setMsg(r.ok ? 'Service created' : d.error || 'Create failed');
    if (r.ok) { setCreating(false); setForm(EMPTY); load(); }
  };

  const toggle = async (svc) => {
    await fetch(`/api/admin/services/${encodeURIComponent(svc.slug)}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !svc.is_active }),
    });
    load();
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto" data-testid="admin-services-page">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-2xl font-bold text-slate-900">Service Catalog</div>
          <div className="text-sm text-slate-500">{services.length} standalone services · canonical price source for checkout</div>
        </div>
        <button onClick={() => setCreating(!creating)} data-testid="new-service-btn" className="text-xs bg-emerald-700 text-white px-3 py-2 rounded-lg flex items-center gap-1.5">
          <Plus className="w-3 h-3" /> New Service
        </button>
      </div>

      {msg && <div className="mb-4 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2" data-testid="services-message">{msg}</div>}

      {creating && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-5 grid grid-cols-1 md:grid-cols-6 gap-2 items-end" data-testid="new-service-form">
          <div><label className="text-[10px] uppercase font-bold text-slate-500">Slug</label><input data-testid="new-service-slug" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
          <div className="md:col-span-2"><label className="text-[10px] uppercase font-bold text-slate-500">Name</label><input data-testid="new-service-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
          <div><label className="text-[10px] uppercase font-bold text-slate-500">Price AED</label><input data-testid="new-service-price" type="number" value={form.price_aed} onChange={e => setForm({ ...form, price_aed: Number(e.target.value) })} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
          <div><label className="text-[10px] uppercase font-bold text-slate-500">Billing</label><select data-testid="new-service-billing" value={form.billing} onChange={e => setForm({ ...form, billing: e.target.value })} className="w-full px-2 py-1.5 border rounded text-sm">{BILLING.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
          <button onClick={create} data-testid="create-service-btn" className="bg-emerald-700 text-white py-1.5 rounded text-xs font-semibold">Create</button>
        </div>
      )}

      <div className="space-y-3">
        {services.map((s) => {
          const d = drafts[s.slug] || {};
          const val = (k) => (d[k] !== undefined ? d[k] : s[k]);
          return (
            <div key={s.slug} className="bg-white border border-slate-200 rounded-2xl p-4" data-testid={`service-row-${s.slug}`}>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-3">
                  <label className="text-[10px] uppercase font-bold text-slate-500">Name</label>
                  <input data-testid={`service-name-${s.slug}`} value={val('name') || ''} onChange={e => setDraft(s.slug, { name: e.target.value })} className="w-full px-2 py-1.5 border rounded text-sm" />
                  <div className="text-[10px] font-mono text-slate-400 mt-1">{s.slug}</div>
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500">Price (AED)</label>
                  <input data-testid={`service-price-${s.slug}`} type="number" value={val('price_aed') ?? 0} onChange={e => setDraft(s.slug, { price_aed: Number(e.target.value) })} className="w-full px-2 py-1.5 border rounded text-sm font-semibold" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500">Billing</label>
                  <select data-testid={`service-billing-${s.slug}`} value={val('billing') || 'one-time'} onChange={e => setDraft(s.slug, { billing: e.target.value })} className="w-full px-2 py-1.5 border rounded text-sm">
                    {BILLING.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="text-[10px] uppercase font-bold text-slate-500">Display label</label>
                  <input data-testid={`service-label-${s.slug}`} value={val('price_label') || ''} onChange={e => setDraft(s.slug, { price_label: e.target.value })} className="w-full px-2 py-1.5 border rounded text-sm" />
                </div>
                <div className="md:col-span-2 flex gap-2">
                  <button onClick={() => save(s.slug)} data-testid={`service-save-${s.slug}`} className="flex-1 bg-emerald-700 text-white py-1.5 rounded text-xs font-semibold inline-flex items-center justify-center gap-1"><Save className="w-3 h-3" /> Save</button>
                  <button onClick={() => toggle(s)} data-testid={`service-toggle-${s.slug}`} className={`px-2 py-1.5 rounded text-[10px] font-bold uppercase ${s.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{s.is_active ? 'Active' : 'Off'}</button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500">Description</label>
                  <textarea data-testid={`service-desc-${s.slug}`} rows={2} value={val('description') || ''} onChange={e => setDraft(s.slug, { description: e.target.value })} className="w-full px-2 py-1.5 border rounded text-sm" />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500">Features (one per line)</label>
                  <textarea data-testid={`service-features-${s.slug}`} rows={2} value={Array.isArray(val('features')) ? val('features').join('\n') : (val('features') || '')} onChange={e => setDraft(s.slug, { features: e.target.value })} className="w-full px-2 py-1.5 border rounded text-sm" />
                </div>
              </div>
            </div>
          );
        })}
        {!services.length && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500 inline-flex items-center gap-2" data-testid="services-empty">
            <Ban className="w-4 h-4" /> No services yet.
          </div>
        )}
      </div>
    </div>
  );
}
