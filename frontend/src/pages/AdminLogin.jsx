import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/use-toast';
import { LogIn, ShieldCheck, KeyRound, ArrowLeft } from 'lucide-react';
import WelcomeSplash from '../components/WelcomeSplash';

const ADMIN_ROLES = ['admin', 'manager', 'staff', 'reviewer'];
const API = process.env.REACT_APP_BACKEND_URL;

export default function AdminLogin() {
  const [step, setStep] = useState('credentials'); // credentials → otp
  const [data, setData] = useState({ email: '', password: '' });
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [splash, setSplash] = useState(null);
  const [pendingUser, setPendingUser] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Step 1: validate password against Supabase auth
  const submitCredentials = async (e) => {
    e.preventDefault();
    if (!data.email || !data.password) {
      toast({ title: 'Enter email and password' });
      return;
    }
    setBusy(true);
    const result = await login(data.email, data.password);
    if (!result.ok) {
      setBusy(false);
      toast({ title: 'Sign in failed', description: result.error });
      return;
    }
    // Password verified — request OTP
    setPendingUser(result.user);
    try {
      const r = await fetch(`${API}/api/admin/auth/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });
      if (!r.ok) throw new Error('Could not send OTP');
      toast({ title: 'OTP sent', description: `Check ${data.email} for the 6-digit code.` });
      setStep('otp');
    } catch (err) {
      toast({ title: 'OTP error', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  // Step 2: verify OTP, then complete login
  const submitOtp = async (e) => {
    e.preventDefault();
    if (otp.replace(/\D/g, '').length !== 6) {
      toast({ title: 'Enter the 6-digit code' });
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/admin/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, code: otp.replace(/\D/g, '') }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.detail || 'Invalid code');
      // SECURITY NOTE: We use sessionStorage (not localStorage) for the admin
      // bearer token so it is auto-cleared when the browser tab closes. The
      // token is short-lived (server-side 30-min TTL) and only valid after the
      // email OTP step. Migrating to HttpOnly cookies would require a server
      // session table — tracked as a follow-up for /admin/* endpoints.
      sessionStorage.setItem('smartsetup_admin_token', body.token);
      sessionStorage.setItem('smartsetup_admin_token_exp', body.expires_at);
      const isAdmin = pendingUser && ADMIN_ROLES.includes(pendingUser.role);
      const destination = isAdmin ? '/admin' : '/dashboard';
      setSplash({
        name: pendingUser?.name || data.email.split('@')[0],
        variant: isAdmin ? 'admin' : 'client',
        redirectTo: destination,
      });
    } catch (err) {
      toast({ title: 'OTP failed', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    setBusy(true);
    try {
      await fetch(`${API}/api/admin/auth/otp/request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });
      toast({ title: 'New code sent', description: `Check ${data.email}.` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {splash && (
        <WelcomeSplash name={splash.name} variant={splash.variant} onDone={() => navigate(splash.redirectTo)} />
      )}
      <Navbar />
      <section className="hero-gradient grain min-h-[80vh]">
        <div className="max-w-5xl mx-auto px-5 lg:px-8 pt-10 pb-16 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 brand-emerald" />
              <span className="text-[10px] uppercase tracking-[0.22em] text-slate-600 font-semibold">Admin Portal · 2-Factor Secure</span>
            </div>
            <h1 className="mt-3 font-display text-2xl lg:text-4xl font-semibold text-slate-900 leading-[1.05]">
              Secure admin access<br />for your operations team.
            </h1>
            <p className="mt-3 text-slate-600 max-w-md text-sm">
              Admin, manager, staff and reviewer roles supported. Every sign-in is protected by an email OTP and recorded in the audit log. Use the regular client login at <span className="font-semibold text-slate-900">/login</span>.
            </p>
            <ul className="mt-4 space-y-1.5 text-[13px] text-slate-700">
              <li>✓ Admin workflows for sales, operations and review</li>
              <li>✓ Email OTP — no token can be reused without the second factor</li>
              <li>✓ Full audit log of every admin action</li>
              <li>✓ Staff sees only clients assigned to them</li>
            </ul>
          </div>

          <div className="card-elevated rounded-3xl p-5 lg:p-7" data-testid="admin-login-card">
            {step === 'credentials' && (
              <>
                <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-slate-500">Step 1 — Admin sign in</div>
                <form onSubmit={submitCredentials} className="space-y-4 mt-4" data-testid="admin-login-form">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Email</label>
                    <Input
                      data-testid="admin-email-input"
                      type="email"
                      value={data.email}
                      onChange={(e) => setData({ ...data, email: e.target.value })}
                      className="mt-1 h-10 rounded-lg text-sm"
                      placeholder="admin@company.com"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Password</label>
                    <Input
                      data-testid="admin-password-input"
                      type="password"
                      value={data.password}
                      onChange={(e) => setData({ ...data, password: e.target.value })}
                      className="mt-1 h-10 rounded-lg text-sm"
                      placeholder="Your password"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={busy}
                    data-testid="admin-login-submit"
                    className="btn-primary rounded-full w-full h-11 text-sm"
                  >
                    {busy ? 'Verifying…' : <><LogIn className="h-4 w-4 mr-2" /> Continue to OTP</>}
                  </Button>
                </form>
              </>
            )}

            {step === 'otp' && (
              <>
                <button
                  type="button"
                  onClick={() => { setStep('credentials'); setOtp(''); }}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" /> Back
                </button>
                <div className="mt-2 text-[10px] uppercase tracking-[0.22em] font-semibold text-slate-500">Step 2 — Enter the 6-digit code</div>
                <p className="mt-2 text-xs text-slate-600">
                  We sent a one-time code to <span className="font-semibold text-slate-900">{data.email}</span>. It expires in 10 minutes.
                </p>
                <form onSubmit={submitOtp} className="space-y-4 mt-4" data-testid="admin-otp-form">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">6-digit code</label>
                    <Input
                      data-testid="admin-otp-input"
                      value={otp}
                      maxLength={7}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="mt-1 h-12 rounded-lg text-center font-mono text-2xl tracking-[0.4em]"
                      placeholder="••••••"
                      inputMode="numeric"
                      autoFocus
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={busy || otp.length !== 6}
                    data-testid="admin-otp-submit"
                    className="btn-primary rounded-full w-full h-11 text-sm"
                  >
                    {busy ? 'Verifying…' : <><KeyRound className="h-4 w-4 mr-2" /> Verify &amp; Sign in</>}
                  </Button>
                </form>
                <div className="mt-3 text-center">
                  <button
                    onClick={resendOtp}
                    disabled={busy}
                    className="text-[11px] font-semibold brand-emerald hover:underline"
                  >
                    Resend code
                  </button>
                </div>
              </>
            )}

            <div className="mt-5 pt-4 border-t border-slate-200 text-[11px] text-slate-500">
              By signing in you agree to our Terms and Privacy Policy. Every action you take here is logged in the admin audit trail.
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
