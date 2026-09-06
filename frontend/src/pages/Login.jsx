import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../hooks/use-toast';
import { Sparkles, LogIn, UserPlus, Mail } from 'lucide-react';
import WelcomeSplash from '../components/WelcomeSplash';

const COUNTRY_CODES = ['+971', '+91', '+92', '+880', '+966', '+974', '+965', '+968', '+973', '+44', '+1', '+65'];

export default function Login() {
  const [mode, setMode] = useState('login');
  const [data, setData] = useState({ name: '', email: '', password: '', phoneCode: '+971', phone: '' });
  const [busy, setBusy] = useState(false);
  const [splash, setSplash] = useState(null); // { name, variant, redirectTo }
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const redirectQuery = new URLSearchParams(location.search).get('redirect');
  const isAdminLogin = location.pathname === '/admin/login';
  const pageLabel = isAdminLogin ? 'Admin Portal' : 'Client Portal';
  const pageDescription = isAdminLogin
    ? 'Admin access for managers, staff and reviewers. Use /admin/login to sign in and manage workflows.'
    : 'Track licence status, upload KYC, view bank account progress and message your advisor. Available 24/7.';

  const submit = async (e) => {
    e.preventDefault();
    if (!data.email || !data.password) {
      toast({ title: 'Enter email and password' });
      return;
    }
    if (mode === 'register' && !data.name) {
      toast({ title: 'Enter your name' });
      return;
    }
    setBusy(true);
    const result =
      mode === 'login'
        ? await login(data.email, data.password)
        : await register(data.name, data.email, data.password, data.phone, data.phoneCode);
    setBusy(false);
    if (!result.ok) {
      toast({ title: 'Authentication failed', description: result.error });
      return;
    }
    // The customer login must always land in the customer portal. Staff use
    // the separate Next.js admin login at /admin/login.
    const clientRedirect = redirectQuery && !redirectQuery.startsWith('/admin') ? redirectQuery : null;
    const destination = isAdminLogin ? '/admin' : (clientRedirect || '/dashboard');
    const variant = isAdminLogin ? 'admin' : 'client';
    setSplash({ name: result.user?.name || data.name || data.email.split('@')[0], variant, redirectTo: destination });
  };

  const handleOAuth = (provider) => {
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    if (!supabaseUrl) {
      toast({ title: 'Configuration missing', description: 'Supabase URL is not set.' });
      return;
    }
    const redirectUrl = `${window.location.origin}/auth/callback${location.pathname === '/admin/login' ? '?redirect=/admin' : ''}`;
    window.location.href = `${supabaseUrl}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div>
      {splash && (
        <WelcomeSplash
          name={splash.name}
          variant={splash.variant}
          onDone={() => navigate(splash.redirectTo)}
        />
      )}
      <Navbar />
      {/* Center-screen loader during sign-in / register so the user knows we
          are working — replaces the corner toast which felt unrelated. */}
      {busy && (
        <div className="fixed inset-0 z-[80] bg-slate-900/55 backdrop-blur-sm grid place-items-center" data-testid="login-loading-overlay">
          <div className="bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-4 max-w-[320px] w-[88vw]">
            <div className="relative h-16 w-16">
              <div className="aria-orbit absolute inset-0 rounded-full" />
              <div className="absolute inset-3 rounded-full bg-emerald-50 grid place-items-center brand-emerald font-display text-2xl font-bold">S</div>
            </div>
            <div className="text-center">
              <div className="font-semibold text-slate-900">{mode === 'login' ? 'Signing you in…' : 'Creating your account…'}</div>
              <div className="text-xs text-slate-500 mt-1">Securely connecting to SmartSetupUAE</div>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-800 animate-pulse" style={{ width: '70%' }} />
            </div>
          </div>
        </div>
      )}
      <section className="hero-gradient grain min-h-[80vh]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 pt-16 pb-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 brand-bronze" />
              <span className="text-xs uppercase tracking-[0.22em] text-slate-600 font-semibold">{pageLabel}</span>
            </div>
            <h1 className="mt-4 font-display text-5xl lg:text-6xl font-semibold text-slate-900 leading-[1.02]">
              Your setup,<br /><span className="shine-text">all in one place.</span>
            </h1>
            <p className="mt-5 text-slate-600 max-w-md">
              {pageDescription}
            </p>
            <ul className="mt-6 space-y-2 text-sm text-slate-700">
              <li>✓ Real-time application tracking</li>
              <li>✓ Secure document vault</li>
              <li>✓ Direct advisor messaging</li>
            </ul>
          </div>
          <div className="card-elevated rounded-3xl p-7 lg:p-9" data-testid="auth-card">
            <div className="flex p-1 bg-slate-100 rounded-full text-sm font-semibold">
              <button
                data-testid="auth-tab-login"
                onClick={() => setMode('login')}
                className={`flex-1 py-2 rounded-full transition ${mode === 'login' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
              >
                Sign in
              </button>
              <button
                data-testid="auth-tab-register"
                onClick={() => setMode('register')}
                className={`flex-1 py-2 rounded-full transition ${mode === 'register' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
              >
                Create account
              </button>
            </div>

            {/* Social login */}
            <div className="mt-6 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleOAuth('google')}
                data-testid="auth-google-btn"
                className="h-11 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-[13px] font-semibold text-slate-700 flex items-center justify-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Google
              </button>
              <button
                type="button"
                onClick={() => handleOAuth('github')}
                data-testid="auth-github-btn"
                className="h-11 rounded-full border border-slate-200 bg-[#24292f] hover:bg-[#1f2328] text-[13px] font-semibold text-white flex items-center justify-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5A11.5 11.5 0 0 0 .5 12c0 5.08 3.29 9.4 7.86 10.93.57.1.78-.25.78-.55v-2.08c-3.2.7-3.87-1.36-3.87-1.36-.52-1.32-1.28-1.67-1.28-1.67-1.05-.72.08-.7.08-.7 1.16.08 1.78 1.2 1.78 1.2 1.03 1.78 2.71 1.27 3.37.97.1-.75.4-1.27.74-1.56-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.44-2.69 5.4-5.26 5.69.42.36.78 1.06.78 2.13v3.16c0 .3.2.66.79.55A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z"/></svg>
                GitHub
              </button>
              <button
                type="button"
                onClick={() => handleOAuth('facebook')}
                data-testid="auth-facebook-btn"
                className="h-11 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-[13px] font-semibold text-slate-700 flex items-center justify-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/></svg>
                Facebook
              </button>
            </div>

            <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
              <div className="flex-1 h-px bg-slate-200" /> or use email <div className="flex-1 h-px bg-slate-200" />
            </div>

            <form onSubmit={submit} className="space-y-4" data-testid="auth-form">
              {mode === 'register' && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Name</label>
                  <Input
                    data-testid="auth-name-input"
                    value={data.name}
                    onChange={(e) => setData({ ...data, name: e.target.value })}
                    className="mt-1.5 h-11 rounded-lg"
                    placeholder="Your full name"
                  />
                </div>
              )}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Email</label>
                <Input
                  data-testid="auth-email-input"
                  type="email"
                  value={data.email}
                  onChange={(e) => setData({ ...data, email: e.target.value })}
                  className="mt-1.5 h-11 rounded-lg"
                  placeholder="you@company.com"
                />
              </div>
              {mode === 'register' && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Phone / WhatsApp</label>
                  <div className="mt-1.5 grid grid-cols-[112px_1fr] gap-2">
                    <select
                      data-testid="auth-phone-code-select"
                      value={data.phoneCode}
                      onChange={(e) => setData({ ...data, phoneCode: e.target.value })}
                      className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                    >
                      {COUNTRY_CODES.map((code) => <option key={code} value={code}>{code}</option>)}
                    </select>
                    <Input
                      data-testid="auth-phone-input"
                      value={data.phone}
                      onChange={(e) => setData({ ...data, phone: e.target.value })}
                      className="h-11 rounded-lg"
                      placeholder="50 123 4567"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Password</label>
                <Input
                  data-testid="auth-password-input"
                  type="password"
                  value={data.password}
                  onChange={(e) => setData({ ...data, password: e.target.value })}
                  className="mt-1.5 h-11 rounded-lg"
                  placeholder="At least 6 characters"
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                data-testid="auth-submit-btn"
                className="btn-primary rounded-full w-full h-12"
              >
                {busy ? (
                  'Please wait…'
                ) : mode === 'login' ? (
                  <><LogIn className="h-4 w-4 mr-2" /> Sign in</>
                ) : (
                  <><UserPlus className="h-4 w-4 mr-2" /> Create account</>
                )}
              </Button>
              <div className="text-[11px] text-center text-slate-500 flex items-center justify-center gap-1">
                <Mail className="h-3 w-3" /> By continuing you agree to our Terms and Privacy Policy.
              </div>
            </form>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}
