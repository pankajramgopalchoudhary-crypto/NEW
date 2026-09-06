'use client';
import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');

  useEffect(() => { fetch('/api/admin/settings', { credentials: 'include' }).then(r => r.json()).then(setSettings); }, []);

  const save = async () => {
    setMsg('');
    const r = await fetch('/api/admin/settings', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
    setMsg(r.ok ? '✓ Saved' : 'Save failed');
  };

  const changePwd = async () => {
    setPwdMsg('');
    if (pwd.next !== pwd.confirm) { setPwdMsg('Passwords do not match'); return; }
    const r = await fetch('/api/admin/auth/change-password', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current: pwd.current, next: pwd.next }) });
    const d = await r.json();
    if (r.ok) { setPwdMsg('✓ Password changed'); setPwd({ current: '', next: '', confirm: '' }); } else setPwdMsg(d.error || 'Failed');
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-5"><div className="text-2xl font-bold text-slate-900">Settings</div><div className="text-sm text-slate-500">Business configuration & account security</div></div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
        <div className="font-bold mb-4">Business Settings</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="WhatsApp Number" value={settings.whatsapp_number} onChange={v => setSettings({ ...settings, whatsapp_number: v })} />
          <Field label="Support Email" value={settings.support_email} onChange={v => setSettings({ ...settings, support_email: v })} />
          <Field label="Early-Bird Discount (%)" type="number" value={settings.early_bird_discount} onChange={v => setSettings({ ...settings, early_bird_discount: Number(v) })} />
          <Field label="Pre-booking Amount (AED)" type="number" value={settings.prebooking_amount} onChange={v => setSettings({ ...settings, prebooking_amount: Number(v) })} />
          <Field label="Founders Free Limit" type="number" value={settings.founders_free_limit} onChange={v => setSettings({ ...settings, founders_free_limit: Number(v) })} />
          <Field label="Founders Paid Limit" type="number" value={settings.founders_paid_limit} onChange={v => setSettings({ ...settings, founders_paid_limit: Number(v) })} />
        </div>
        <div className="mt-4 flex items-center justify-between">
          {msg && <span className={`text-xs ${msg.startsWith('✓') ? 'text-emerald-700' : 'text-rose-600'}`}>{msg}</span>}
          <button onClick={save} className="text-xs bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 ml-auto"><Save className="w-3.5 h-3.5" /> Save Settings</button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="font-bold mb-4">Change Founder Password</div>
        <div className="space-y-3">
          <Field label="Current Password" type="password" value={pwd.current} onChange={v => setPwd({ ...pwd, current: v })} />
          <Field label="New Password" type="password" value={pwd.next} onChange={v => setPwd({ ...pwd, next: v })} />
          <Field label="Confirm New Password" type="password" value={pwd.confirm} onChange={v => setPwd({ ...pwd, confirm: v })} />
        </div>
        <div className="mt-4 flex items-center justify-between">
          {pwdMsg && <span className={`text-xs ${pwdMsg.startsWith('✓') ? 'text-emerald-700' : 'text-rose-600'}`}>{pwdMsg}</span>}
          <button onClick={changePwd} className="text-xs bg-emerald-700 text-white px-4 py-2 rounded-lg ml-auto">Update Password</button>
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
