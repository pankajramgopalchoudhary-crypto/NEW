'use client';
import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';

const PAGES = [
  { slug: 'privacy', label: 'Privacy Policy' },
  { slug: 'terms', label: 'Terms of Service' },
  { slug: 'refund', label: 'Refund Policy' },
  { slug: 'cookies', label: 'Cookie Policy' },
  { slug: 'about', label: 'About Us' },
];

export default function LegalPage() {
  const [active, setActive] = useState('privacy');
  const [content, setContent] = useState({});
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/admin/legal', { credentials: 'include' }).then(r => r.json()).then(d => setContent(d.pages || {})).catch(() => {});
  }, []);

  const save = async () => {
    setMsg('Saving…');
    const r = await fetch(`/api/admin/legal/${active}`, {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content[active] || '' }),
    });
    setMsg(r.ok ? '✓ Saved · live on website' : 'Save failed');
    setTimeout(() => setMsg(''), 2500);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-5">
        <div className="text-2xl font-bold text-slate-900">Legal & Footer</div>
        <div className="text-sm text-slate-500">Edit legal pages and footer content shown on the public website.</div>
      </div>

      <div className="flex gap-1 mb-3 flex-wrap">
        {PAGES.map(p => (
          <button key={p.slug} onClick={() => setActive(p.slug)} className={`px-3 py-1.5 text-xs rounded font-semibold ${active === p.slug ? 'bg-[#0A3D34] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{p.label}</button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="font-bold text-slate-900 mb-3">{PAGES.find(p => p.slug === active)?.label}</div>
        <textarea
          rows={18}
          value={content[active] || ''}
          onChange={(e) => setContent({ ...content, [active]: e.target.value })}
          placeholder="Markdown or HTML allowed. This content is published on smartsetupuae.ae instantly after save."
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
        />
        <div className="mt-4 flex items-center justify-between">
          {msg && <span className={`text-xs ${msg.startsWith('✓') ? 'text-emerald-700' : 'text-rose-600'}`}>{msg}</span>}
          <button onClick={save} className="text-xs bg-[#0A3D34] text-white px-4 py-2 rounded-lg flex items-center gap-1.5 ml-auto"><Save className="w-3.5 h-3.5" /> Save Page</button>
        </div>
      </div>
    </div>
  );
}
