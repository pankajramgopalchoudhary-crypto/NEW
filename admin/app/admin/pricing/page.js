'use client';
import { useEffect, useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';

export default function PricingPage() {
  const [pricing, setPricing] = useState([]);
  const [dirty, setDirty] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [costs, setCosts] = useState([]);
  const [costDirty, setCostDirty] = useState({});
  const [costSaving, setCostSaving] = useState(false);
  const [costMsg, setCostMsg] = useState('');

  const loadCosts = async () => {
    const r = await fetch('/api/admin/pricing/visa-costs', { credentials: 'include' });
    const d = await r.json();
    setCosts(d.costs || []);
    setCostDirty({});
  };

  const setCost = (zone, field, value) => {
    setCostDirty((prev) => ({ ...prev, [zone]: { ...(prev[zone] || {}), [field]: value === '' ? '' : Number(value) } }));
  };
  const costVal = (row, field) => (costDirty[row.freezone]?.[field] != null ? costDirty[row.freezone][field] : row[field] || 0);

  const saveCosts = async () => {
    setCostSaving(true); setCostMsg('');
    const updates = Object.entries(costDirty).map(([freezone, fields]) => ({ freezone, ...fields }));
    if (!updates.length) { setCostMsg('No changes'); setCostSaving(false); return; }
    const r = await fetch('/api/admin/pricing/visa-costs', {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
    const d = await r.json();
    if (d.ok) { setCostMsg(`✓ Saved ${d.results?.length || 0} zones · live on checkout`); loadCosts(); }
    else setCostMsg(d.error || 'Save failed');
    setCostSaving(false);
  };

  const load = async () => {
    const r = await fetch('/api/admin/pricing', { credentials: 'include' });
    const d = await r.json();
    setPricing(d.pricing || []);
    setDirty({});
  };
  useEffect(() => { load(); loadCosts(); }, []);

  const setVal = (zone, field, value) => {
    setDirty(prev => ({ ...prev, [zone]: { ...(prev[zone] || {}), [field]: value === '' ? '' : Number(value) } }));
  };

  const getDisplay = (row, field) => (dirty[row.freezone]?.[field] != null ? dirty[row.freezone][field] : row[field] || 0);

  const save = async () => {
    setSaving(true);
    setMsg('');
    const updates = Object.entries(dirty).map(([freezone, fields]) => ({ freezone, ...fields }));
    if (updates.length === 0) { setMsg('No changes'); setSaving(false); return; }
    const r = await fetch('/api/admin/pricing/bulk', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates }) });
    const d = await r.json();
    if (d.ok) { setMsg(`✓ Saved ${d.results?.length || 0} updates · live on website`); load(); } else setMsg(d.error || 'Save failed');
    setSaving(false);
  };

  const toggleActive = async (zone, current) => {
    const row = pricing.find(p => p.freezone === zone);
    if (row && row.packages.length) {
      for (const p of row.packages) {
        await fetch(`/api/admin/packages/${p.id}`, { method: current ? 'DELETE' : 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !current }) });
      }
    }
    load();
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="text-2xl font-bold text-slate-900">Pricing Configuration</div>
          <div className="text-sm text-slate-500">Edit package prices for all zones. Changes reflect immediately on the website.</div>
        </div>
        <div className="flex gap-2 items-center">
          {msg && <span className={`text-xs ${msg.startsWith('✓') ? 'text-emerald-700' : 'text-rose-600'}`}>{msg}</span>}
          <button onClick={load} className="text-xs border border-slate-200 px-3 py-2 rounded-lg flex items-center gap-1.5"><RotateCcw className="w-3 h-3" /> Reset</button>
          <button onClick={save} disabled={saving} className="text-xs bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 disabled:opacity-50"><Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-1 mb-4">
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-slate-900 flex items-center gap-2"><span className="w-2 h-2 bg-emerald-600 rounded" /> Free Zone Packages</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">VAT-inclusive government fees</div>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b">
                <th className="text-left py-2">Jurisdiction</th>
                <th className="text-left py-2 w-40">Without Visa (AED)</th>
                <th className="text-left py-2 w-40">With 1 Visa (AED)</th>
                <th className="text-left py-2 w-40">With 2 Visa (AED)</th>
                <th className="text-center py-2 w-24">Status</th>
                <th className="text-center py-2 w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pricing.map(row => (
                <tr key={row.freezone}>
                  <td className="py-2.5 font-semibold text-slate-800">{row.freezone}</td>
                  <td><input type="number" value={getDisplay(row, 'without_visa')} onChange={e => setVal(row.freezone, 'without_visa', e.target.value)} className="w-32 px-2 py-1 border border-slate-200 rounded text-sm" /></td>
                  <td><input type="number" value={getDisplay(row, 'with_1_visa')} onChange={e => setVal(row.freezone, 'with_1_visa', e.target.value)} className="w-32 px-2 py-1 border border-slate-200 rounded text-sm" /></td>
                  <td><input type="number" value={getDisplay(row, 'with_2_visa')} onChange={e => setVal(row.freezone, 'with_2_visa', e.target.value)} className="w-32 px-2 py-1 border border-slate-200 rounded text-sm" /></td>
                  <td className="text-center"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${row.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{row.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="text-center"><button onClick={() => toggleActive(row.freezone, row.is_active)} className="text-xs border border-rose-200 text-rose-600 px-2 py-1 rounded hover:bg-rose-50">{row.is_active ? 'Deactivate' : 'Activate'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl p-4" data-testid="visa-costs-panel">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <div>
            <div className="font-bold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded" /> Per-Zone Government Costs
            </div>
            <div className="text-xs text-slate-500">
              Investor visa is no longer a fixed price — checkout &amp; the cost calculator read these values live per free zone.
            </div>
          </div>
          <div className="flex items-center gap-2">
            {costMsg && <span className={`text-xs ${costMsg.startsWith('✓') ? 'text-emerald-700' : 'text-rose-600'}`}>{costMsg}</span>}
            <button onClick={loadCosts} className="text-xs border border-slate-200 px-3 py-2 rounded-lg flex items-center gap-1.5" data-testid="visa-costs-reset">
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
            <button onClick={saveCosts} disabled={costSaving} className="text-xs bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 disabled:opacity-50" data-testid="visa-costs-save">
              <Save className="w-3.5 h-3.5" /> {costSaving ? 'Saving…' : 'Save Costs'}
            </button>
          </div>
        </div>
        <table className="w-full text-sm mt-3">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-500 border-b">
              <th className="text-left py-2">Jurisdiction</th>
              <th className="text-left py-2 w-36">Investor Visa</th>
              <th className="text-left py-2 w-36">Employee Visa</th>
              <th className="text-left py-2 w-36">Visa Later</th>
              <th className="text-left py-2 w-36">Estab. Card</th>
              <th className="text-left py-2 w-36">Medical + EID</th>
              <th className="text-left py-2 w-36">Renewal</th>
              <th className="text-left py-2">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {costs.map((row) => (
              <tr key={row.freezone} data-testid={`visa-cost-row-${row.freezone}`}>
                <td className="py-2.5 font-semibold text-slate-800">{row.freezone}</td>
                {['investor_visa_cost', 'employee_visa_cost', 'visa_later_cost', 'establishment_card_cost', 'medical_emirates_id_cost', 'renewal_cost'].map((f) => (
                  <td key={f}>
                    <input
                      type="number"
                      value={costVal(row, f)}
                      onChange={(e) => setCost(row.freezone, f, e.target.value)}
                      data-testid={`visa-cost-${row.freezone}-${f}`}
                      className="w-28 px-2 py-1 border border-slate-200 rounded text-sm"
                    />
                  </td>
                ))}
                <td className="text-[11px] text-slate-400 max-w-[220px] truncate" title={row.notes || ''}>{row.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
