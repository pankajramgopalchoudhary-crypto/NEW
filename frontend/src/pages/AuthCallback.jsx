import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [message, setMessage] = useState('Completing sign-in…');

  useEffect(() => {
    const run = async () => {
const rawHash = window.location.hash ? window.location.hash.substring(1) : '';
    const rawSearch = window.location.search ? window.location.search.substring(1) : '';
    const hashParams = new URLSearchParams(rawHash);
    const searchParams = new URLSearchParams(rawSearch);
    const params = new URLSearchParams([...searchParams.entries(), ...hashParams.entries()]);

      const error = params.get('error_description') || params.get('error');
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token') || '';

      if (error) {
        setMessage('Sign-in failed. Redirecting…');
        window.history.replaceState(null, '', window.location.pathname);
        setTimeout(() => navigate('/login?error=' + encodeURIComponent(error)), 1200);
        return;
      }

      if (!accessToken) {
        navigate('/login');
        return;
      }

      const result = await loginWithToken(accessToken, refreshToken);

      // Ensure a profile row exists for OAuth signups (Google/Facebook/GitHub).
      // Server-side trigger normally handles this but we POST defensively in
      // case the user signed up via OAuth where the trigger missed metadata.
      try {
        const me = result.user || null;
        if (me?.id) {
          const supaUrl = process.env.REACT_APP_SUPABASE_URL;
          const anon = process.env.REACT_APP_SUPABASE_ANON_KEY;
          await fetch(`${supaUrl}/rest/v1/profiles`, {
            method: 'POST',
            headers: {
              apikey: anon,
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates,return=minimal',
            },
            body: JSON.stringify({
              id: me.id,
              email: me.email,
              full_name: me.user_metadata?.full_name || me.user_metadata?.name || me.email?.split('@')[0],
            }),
          });
        }
      } catch (_) { /* best-effort */ }

      window.history.replaceState(null, '', window.location.pathname);
      if (result.ok) {
        const redirectParam = new URLSearchParams(window.location.search).get('redirect');
        const adminRoles = ['admin', 'manager', 'staff', 'reviewer'];
        const destination = redirectParam || (result.user && adminRoles.includes(result.user.role) ? '/admin' : '/dashboard');
        navigate(destination);
      } else {
        setMessage('Could not complete sign-in. Redirecting…');
        setTimeout(() => navigate('/login?error=' + encodeURIComponent(result.error || 'oauth')), 1200);
      }
    };
    run();
  }, [loginWithToken, navigate]);

  return (
    <div className="min-h-[60vh] grid place-items-center bg-[#FFFCF5]" data-testid="auth-callback">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 rounded-2xl bg-emerald-50 grid place-items-center mb-4">
          <span className="brand-emerald font-display text-lg font-bold">S</span>
        </div>
        <p className="text-slate-600">{message}</p>
      </div>
    </div>
  );
}
