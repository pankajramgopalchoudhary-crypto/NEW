'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Save, Layers, MapPin } from 'lucide-react';

const TABS = [
  { id: 'packages', label: 'Setup Packages' },
  { id: 'jurisdictions', label: 'Jurisdictions' },
];
const EMPTY_PKG = { freezone: '', package_name: '', category: 'Core UAE', duration: '1 Year', workspace: '', package_price: 0, pricing_mode: 'fixed', includes_visa: 0, notes: '' };

export default function PriceCatalogPage() {
  const [tab, setTab] = useState('packages');
  const [packages, setPackages] = useState([]);
  const [jurisdictions, setJurisdictions] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [zoneFilter, setZoneFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_PKG);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const [p, j] = await Promise.all([
      fetch('/api/admin/catalog/packages', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/admin/catalog/jurisdictions', { credentials: 'include' }).then((r) => r.json()),
    ]);
    setPackages(p.packages || []);
    setJurisdictions(j.jurisdictions || []);
    setDrafts({});
  }, []);
  useEffect(() => { load(); }, [load]);

  const zones = useMemo(
    () => Array.from(new Set(packages.map((p) => p.freezone))).sort(),
    [packages],
  );
  const shownPackages = useMemo(
    () => (zoneFilter ? packages.filter((p) => p.freezone === zoneFilter) : packages),
    [packages, zoneFilter],
  );

  const setDraft = (id, patch) => setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  const val = (row, key) => (drafts[row.id]?.[key] !== undefined ? drafts[row.id][key] : row[key]);

  const savePackage = async (id) => {
    const patch = drafts[id];
    if (!patch) return;
    const r = await fetch(`/api/admin/catalog/packages/${id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    });
    const d = await r.json();
    setMsg(r.ok ? 'Package saved — live on the website immediately' : d.error || 'Save failed');
    load();
  };

  const saveJurisdiction = async (slug) => {
    const patch = drafts[slug];
    if (!patch) return;
    const r = await fetch(`/api/admin/catalog/jurisdictions/${encodeURIComponent(slug)}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    });
    const d = await r.json();
    setMsg(r.ok ? 'Jurisdiction saved' : d.error || 'Save failed');
    load();
  };

  const createPackage = async () => {
    const r = await fetch('/api/admin/catalog/packages', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const d = await r.json();
    setMsg(r.ok ? 'Package created' : d.error || 'Create failed');
    if (r.ok) { setCreating(false); setForm(EMPTY_PKG); load(); }
  };

  const togglePackage = async (row) => {
    await fetch(`/api/admin/catalog/packages/${row.id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !row.is_active }),
    });
    load();
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto" data-testid="admin-catalog-page">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-2xl font-bold text-slate-900">Price Catalog</div>
          <div className="text-sm text-slate-500">
            {packages.length} packages · {jurisdictions.length} jurisdictions · canonical price source for the website
          </div>
        </div>
        <button onClick={() => setCreating(!creating)} data-testid="new-package-btn" className="text-xs bg-emerald-700 text-white px-3 py-2 rounded-lg flex items-center gap-1.5">
          <Plus className="w-3 h-3" /> New Package
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-testid={`catalog-tab-${t.id}`}
            className={`text-xs font-semibold px-3 py-2 rounded-lg inline-flex items-center gap-1.5 ${tab === t.id ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
          >
            {t.id === 'packages' ? <Layers className="w-3 h-3" /> : <MapPin className="w-3 h-3" />} {t.label}
          </button>
        ))}
      </div>

      {msg && <div className="mb-4 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg px-3 py-2" data-testid="catalog-message">{msg}</div>}

      {creating && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-5 grid grid-cols-1 md:grid-cols-6 gap-2 items-end" data-testid="new-package-form">
          <div><label className="text-[10px] uppercase font-bold text-slate-500">Free zone</label><input data-testid="new-package-freezone" value={form.freezone} onChange={(e) => setForm({ ...form, freezone: e.target.value })} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
          <div className="md:col-span-2"><label className="text-[10px] uppercase font-bold text-slate-500">Package name</label><input data-testid="new-package-name" value={form.package_name} onChange={(e) => setForm({ ...form, package_name: e.target.value })} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
          <div><label className="text-[10px] uppercase font-bold text-slate-500">Price AED</label><input data-testid="new-package-price" type="number" value={form.package_price} onChange={(e) => setForm({ ...form, package_price: Number(e.target.value) })} className="w-full px-2 py-1.5 border rounded text-sm" /></div>
          <div><label className="text-[10px] uppercase font-bold text-slate-500">Pricing</label>
            <select data-testid="new-package-mode" value={form.pricing_mode} onChange={(e) => setForm({ ...form, pricing_mode: e.target.value })} className="w-full px-2 py-1.5 border rounded text-sm">
              <option value="fixed">fixed</option><option value="on_request">on request</option>
            </select>
          </div>
          <button onClick={createPackage} data-testid="create-package-btn" className="bg-emerald-700 text-white py-1.5 rounded text-xs font-semibold">Create</button>
        </div>
      )}

      {tab === 'packages' && (
        <>
          <div className="mb-3 flex items-center gap-2">
            <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} data-testid="catalog-zone-filter" className="px-2 py-1.5 border rounded text-sm bg-white">
              <option value="">All free zones ({packages.length})</option>
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2">Free zone</th>
                  <th className="text-left px-3 py-2">Package</th>
                  <th className="text-left px-3 py-2">Duration</th>
                  <th className="text-left px-3 py-2">Price (AED)</th>
                  <th className="text-left px-3 py-2">Pricing</th>
                  <th className="text-left px-3 py-2">Source</th>
                  <th className="text-left px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {shownPackages.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100" data-testid={`package-row-${row.id}`}>
                    <td className="px-3 py-2 whitespace-nowrap font-semibold text-slate-800">{row.freezone}</td>
                    <td className="px-3 py-2 min-w-[240px]">
                      <input data-testid={`package-name-${row.id}`} value={val(row, 'package_name') || ''} onChange={(e) => setDraft(row.id, { package_name: e.target.value })} className="w-full px-2 py-1 border rounded text-sm" />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-500">{row.duration}</td>
                    <td className="px-3 py-2">
                      <input data-testid={`package-price-${row.id}`} type="number" value={val(row, 'package_price') ?? 0} onChange={(e) => setDraft(row.id, { package_price: Number(e.target.value) })} className="w-28 px-2 py-1 border rounded text-sm font-semibold" />
                    </td>
                    <td className="px-3 py-2">
                      <select data-testid={`package-mode-${row.id}`} value={val(row, 'pricing_mode') || 'fixed'} onChange={(e) => setDraft(row.id, { pricing_mode: e.target.value })} className="px-2 py-1 border rounded text-xs">
                        <option value="fixed">fixed</option><option value="on_request">on request</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-slate-400 font-mono">{row.source || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button onClick={() => savePackage(row.id)} data-testid={`package-save-${row.id}`} className="bg-emerald-700 text-white px-3 py-1 rounded text-xs font-semibold inline-flex items-center gap-1"><Save className="w-3 h-3" /> Save</button>
                      <button onClick={() => togglePackage(row)} data-testid={`package-toggle-${row.id}`} className={`ml-2 px-2 py-1 rounded text-[10px] font-bold uppercase ${row.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{row.is_active ? 'Active' : 'Off'}</button>
                    </td>
                  </tr>
                ))}
                {!shownPackages.length && <tr><td colSpan={7} className="py-10 text-center text-slate-400" data-testid="catalog-packages-empty">No packages</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'jurisdictions' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Kind</th>
                <th className="text-left px-3 py-2">Gov fee</th>
                <th className="text-left px-3 py-2">Gov + visa</th>
                <th className="text-left px-3 py-2">Service fee</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {jurisdictions.map((row) => (
                <tr key={row.slug} className="border-t border-slate-100" data-testid={`jurisdiction-row-${row.slug}`}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="font-semibold text-slate-800">{row.name}</div>
                    <div className="text-[10px] font-mono text-slate-400">{row.slug}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-500 text-xs">{row.kind}</td>
                  {['gov', 'govVisa', 'svc'].map((k) => (
                    <td className="px-3 py-2" key={k}>
                      <input data-testid={`jurisdiction-${k}-${row.slug}`} type="number" value={val(row, k) ?? 0} onChange={(e) => setDraft(row.slug, { [k]: Number(e.target.value) })} className="w-24 px-2 py-1 border rounded text-sm" />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <select data-testid={`jurisdiction-status-${row.slug}`} value={val(row, 'status') || 'ACTIVE'} onChange={(e) => setDraft(row.slug, { status: e.target.value })} className="px-2 py-1 border rounded text-xs">
                      {['ACTIVE', 'COMING_SOON', 'PRICING_AUDIT', 'UNDER_REVIEW', 'HIDDEN'].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => saveJurisdiction(row.slug)} data-testid={`jurisdiction-save-${row.slug}`} className="bg-emerald-700 text-white px-3 py-1 rounded text-xs font-semibold inline-flex items-center gap-1"><Save className="w-3 h-3" /> Save</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
