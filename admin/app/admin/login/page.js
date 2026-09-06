'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import BrandMark from '@/components/BrandMark';

const ROLES = [
  { key: 'founder', label: 'Founder', mode: 'password' },
  { key: 'manager', label: 'Manager', mode: 'password' },
  { key: 'staff', label: 'Staff', mode: 'pin' },
  { key: 'reviewer', label: 'Reviewer', mode: 'pin' },
];

const DEFAULTS = {
  founder: { email: '', password: '' },
  manager: { email: '', password: '' },
  staff: { username: '', pin: '' },
  reviewer: { username: '', pin: '' },
};

export default function AdminLoginPage() {
  const router = useRouter();
  const [role, setRole] = useState('founder');
  const [data, setData] = useState({ email: DEFAULTS.founder.email, password: '', username: '', pin: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const switchRole = (r) => {
    setRole(r);
    setError('');
    const d = DEFAULTS[r];
    if (d.email) setData({ email: d.email, password: '', username: '', pin: '' });
    else setData({ email: '', password: '', username: d.username, pin: '' });
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const mode = ROLES.find(r => r.key === role).mode;
    const endpoint = mode === 'pin' ? '/api/admin/auth/pin' : '/api/admin/auth/login';
    const body = mode === 'pin'
      ? { username: data.username, pin: data.pin, role }
      : { email: data.email, password: data.password, role };
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });
      const json = await r.json();
      if (!r.ok) {
        setError(json.error || 'Login failed');
        setBusy(false);
        return;
      }
      try { localStorage.setItem('ss_admin_token', json.token); } catch {}
      try { localStorage.setItem('ss_admin_user', JSON.stringify(json.user)); } catch {}
      router.push('/admin/dashboard');
    } catch (err) {
      setError(String(err.message || err));
      setBusy(false);
    }
  };

  const currentRole = ROLES.find(r => r.key === role);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F5F7FA] via-white to-[#fdf6e3] p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-[#0A3D34]/10">
        <div className="flex flex-col items-center mb-6">
          <BrandMark size={64} showWordmark={true} showTagline={true} />
          <div className="mt-3 text-[10px] uppercase tracking-[0.3em] text-[#0A3D34]/60 font-semibold">Admin Portal</div>
        </div>

        <div className="flex gap-1 bg-[#0A3D34]/5 p-1 rounded-xl mb-6" data-testid="role-tabs">
          {ROLES.map(r => (
            <button
              key={r.key}
              type="button"
              onClick={() => switchRole(r.key)}
              data-testid={`role-tab-${r.key}`}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${role === r.key ? 'bg-white text-[#0A3D34] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-4">
          {currentRole.mode === 'password' ? (
            <>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                <input
                  type="email"
                  required
                  data-testid="login-email"
                  className="mt-1 w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                  value={data.email}
                  onChange={(e) => setData({ ...data, email: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Password</label>
                <input
                  type="password"
                  required
                  data-testid="login-password"
                  placeholder="Password"
                  className="mt-1 w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                  value={data.password}
                  onChange={(e) => setData({ ...data, password: e.target.value })}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Username</label>
                <input
                  type="text"
                  required
                  data-testid="login-username"
                  className="mt-1 w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
                  value={data.username}
                  onChange={(e) => setData({ ...data, username: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">PIN (4–6 digits)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  data-testid="login-pin"
                  className="mt-1 w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 tracking-[0.4em]"
                  value={data.pin}
                  onChange={(e) => setData({ ...data, pin: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })}
                />
              </div>
            </>
          )}

          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2" data-testid="login-error">{error}</div>
          )}

          <button
            type="submit"
            disabled={busy}
            data-testid="login-submit"
            className="w-full py-3 bg-[#0A3D34] hover:bg-[#062A24] disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition"
          >
            {busy ? 'Signing in…' : <><LogIn className="w-4 h-4" /> Sign In as {currentRole.label}</>}
          </button>
        </form>

        <div className="mt-6 bg-[#0A3D34]/5 border border-[#0A3D34]/10 rounded-xl p-4 text-xs">
          <div className="font-semibold text-[#0A3D34] mb-1">Need access?</div>
          <div className="text-slate-600">Contact your administrator to receive your login credentials or PIN.</div>
        </div>

        <a href="https://smartsetupuae.ae" className="mt-6 block text-center text-sm text-slate-500 hover:text-[#0A3D34]">← Back to website</a>
        <div className="mt-3 text-center text-[10px] text-slate-400">Axiscrest Global FZE LLC · Lic: 262843696888</div>
      </div>
    </div>
  );
}
