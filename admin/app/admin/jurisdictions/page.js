'use client';
import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const FREEZONES = ['ANCFZ', 'SPC', 'RAKEZ', 'IFZA', 'Meydan', 'SHAMS', 'DMCC', 'JAFZA', 'KIZAD', 'DAFZA'];
const MAINLAND = ['Dubai DED', 'Abu Dhabi DED', 'Sharjah DED', 'Ajman DED', 'RAK DED'];

export default function JurisdictionsPage() {
  const [pricing, setPricing] = useState([]);
  const [hidden, setHidden] = useState({});

  useEffect(() => {
    fetch('/api/admin/pricing', { credentials: 'include' }).then(r => r.json()).then(d => setPricing(d.pricing || []));
    try {
      const stored = JSON.parse(localStorage.getItem('ss_jurisdiction_hidden') || '{}');
      setHidden(stored);
    } catch {}
  }, []);

  const toggle = (name) => {
    const next = { ...hidden, [name]: !hidden[name] };
    setHidden(next);
    localStorage.setItem('ss_jurisdiction_hidden', JSON.stringify(next));
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="mb-5">
        <div className="text-2xl font-bold text-slate-900">Jurisdictions</div>
        <div className="text-sm text-slate-500">Control which UAE jurisdictions appear on the public website.</div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
        <div className="font-bold text-slate-900 mb-3">🏝️ Free Zones</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {FREEZONES.map(z => {
            const p = pricing.find(r => r.freezone === z);
            const hasPricing = p && (p.without_visa || p.with_1_visa);
            const isHidden = hidden[z];
            return (
              <div key={z} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <div className="font-semibold text-slate-800">{z}</div>
                  <div className="text-xs text-slate-500">{hasPricing ? `From AED ${(p.without_visa || p.with_1_visa).toLocaleString()}` : 'No pricing yet'}</div>
                </div>
                <button onClick={() => toggle(z)} className={`text-xs px-3 py-1.5 rounded font-semibold flex items-center gap-1.5 ${isHidden ? 'bg-slate-200 text-slate-700' : 'bg-[#0A3D34]/10 text-[#0A3D34]'}`}>
                  {isHidden ? <><EyeOff className="w-3 h-3" /> Hidden</> : <><Eye className="w-3 h-3" /> Visible</>}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="font-bold text-slate-900 mb-3">🏢 Mainland Departments</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {MAINLAND.map(m => {
            const isHidden = hidden[m];
            return (
              <div key={m} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="font-semibold text-slate-800">{m}</div>
                <button onClick={() => toggle(m)} className={`text-xs px-3 py-1.5 rounded font-semibold flex items-center gap-1.5 ${isHidden ? 'bg-slate-200 text-slate-700' : 'bg-[#0A3D34]/10 text-[#0A3D34]'}`}>
                  {isHidden ? <><EyeOff className="w-3 h-3" /> Hidden</> : <><Eye className="w-3 h-3" /> Visible</>}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-500">Note: visibility toggles are stored locally for now. To sync them to the public website, edit the freezone in <span className="font-semibold text-[#0A3D34]">Pricing & Packages</span> and use the Activate/Deactivate button — that one writes to Supabase.</div>
    </div>
  );
}
