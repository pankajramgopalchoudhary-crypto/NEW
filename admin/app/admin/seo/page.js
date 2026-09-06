'use client';
import { useEffect, useState } from 'react';
import { Save, Sparkles } from 'lucide-react';

const PAGES = [
  { slug: 'home', label: 'Homepage', defaultTitle: 'SmartSetupUAE — Setup Smart. Grow Fast.' },
  { slug: 'free-zones', label: 'Free Zones' },
  { slug: 'mainland', label: 'Mainland' },
  { slug: 'golden-visa', label: 'Golden Visa' },
  { slug: 'aria', label: 'Aria AI Search' },
  { slug: 'about', label: 'About Us' },
  { slug: 'contact', label: 'Contact' },
];

export default function SeoPage() {
  const [active, setActive] = useState('home');
  const [meta, setMeta] = useState({});
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/admin/seo', { credentials: 'include' }).then(r => r.json()).then(d => setMeta(d.pages || {})).catch(() => {});
  }, []);

  const current = meta[active] || {};

  const set = (k, v) => setMeta(prev => ({ ...prev, [active]: { ...(prev[active] || {}), [k]: v } }));

  const save = async () => {
    setMsg('Saving…');
    const r = await fetch(`/api/admin/seo/${active}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meta[active] || {}),
    });
    setMsg(r.ok ? '✓ Saved · live on website meta tags' : 'Save failed');
    setTimeout(() => setMsg(''), 2500);
  };

  const generateSitemap = async () => {
    const r = await fetch('/api/admin/seo/sitemap', { method: 'POST', credentials: 'include' });
    const d = await r.json();
    alert(d.ok ? `✓ Sitemap generated with ${d.urls} URLs` : (d.error || 'Failed'));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-2xl font-bold text-slate-900">SEO Manager</div>
          <div className="text-sm text-slate-500">Per-page meta tags + sitemap for search engines.</div>
        </div>
        <button onClick={generateSitemap} className="text-xs bg-[#D4AF37] text-[#0A3D34] px-3 py-2 rounded-lg flex items-center gap-1.5 font-semibold"><Sparkles className="w-3.5 h-3.5" /> Generate Sitemap</button>
      </div>

      <div className="flex gap-1 mb-3 flex-wrap">
        {PAGES.map(p => (
          <button key={p.slug} onClick={() => setActive(p.slug)} className={`px-3 py-1.5 text-xs rounded font-semibold ${active === p.slug ? 'bg-[#0A3D34] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{p.label}</button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <div className="font-bold text-slate-900">{PAGES.find(p => p.slug === active)?.label} — SEO Settings</div>
        <Field label="Meta Title (60 chars max)" value={current.title} onChange={v => set('title', v)} maxLength={60} />
        <Field label="Meta Description (160 chars max)" value={current.description} onChange={v => set('description', v)} maxLength={160} textarea />
        <Field label="Keywords (comma-separated)" value={current.keywords} onChange={v => set('keywords', v)} />
        <Field label="OG Image URL" value={current.og_image} onChange={v => set('og_image', v)} />
        <Field label="Canonical URL" value={current.canonical} onChange={v => set('canonical', v)} />
        <div className="flex items-center justify-between pt-2">
          {msg && <span className={`text-xs ${msg.startsWith('✓') ? 'text-emerald-700' : 'text-rose-600'}`}>{msg}</span>}
          <button onClick={save} className="text-xs bg-[#0A3D34] text-white px-4 py-2 rounded-lg flex items-center gap-1.5 ml-auto"><Save className="w-3.5 h-3.5" /> Save SEO</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, textarea, maxLength }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</label>
        {maxLength && <span className="text-[10px] text-slate-400">{(value || '').length}/{maxLength}</span>}
      </div>
      {textarea ? (
        <textarea rows={2} value={value || ''} onChange={e => onChange(e.target.value)} maxLength={maxLength} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
      ) : (
        <input value={value || ''} onChange={e => onChange(e.target.value)} maxLength={maxLength} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
      )}
    </div>
  );
}
