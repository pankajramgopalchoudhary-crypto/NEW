import React, { createContext, useContext, useEffect, useState } from 'react';
import { postgrestValue, supabaseRest } from '../lib/supabaseRest';
import { getToken, setToken, clearToken } from '../lib/authTokenStorage';

const AuthContext = createContext(null);

function normalizeUser(authUser, profile) {
  return {
    id: authUser?.id,
    email: authUser?.email,
    name: profile?.full_name || profile?.name || authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || 'Client',
    phone: profile?.phone || authUser?.phone || authUser?.user_metadata?.phone || '',
    role: profile?.role || 'client',
    is_active: profile?.is_active !== false,
  };
}

async function loadProfile(authUser, token) {
  // Your current Supabase already uses public.profiles with role app_role.
  // Keep admin_profiles/client_profiles fallback for older builds.
  const existingProfile = await supabaseRest.select('profiles', `?select=*&or=(id.eq.${postgrestValue(authUser.id)},email.eq.${postgrestValue(authUser.email || '')})&limit=1`, token).catch(() => []);
  if (existingProfile?.[0]) return normalizeUser(authUser, existingProfile[0]);

  const admin = await supabaseRest.select('admin_profiles', `?select=*&user_id=eq.${postgrestValue(authUser.id)}&is_active=eq.true&limit=1`, token).catch(() => []);
  if (admin?.[0]) return normalizeUser(authUser, admin[0]);

  const client = await supabaseRest.select('client_profiles', `?select=*&user_id=eq.${postgrestValue(authUser.id)}&limit=1`, token).catch(() => []);
  if (client?.[0]) return normalizeUser(authUser, client[0]);

  const fallbackName = authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || 'Client';
  const [createdProfile] = await supabaseRest.insert('profiles', [{
    id: authUser.id,
    email: authUser.email,
    full_name: fallbackName,
    role: 'client',
  }], token).catch(() => [null]);
  if (createdProfile) return normalizeUser(authUser, createdProfile);

  const [createdClient] = await supabaseRest.insert('client_profiles', [{
    user_id: authUser.id,
    email: authUser.email,
    full_name: fallbackName,
    phone: authUser?.user_metadata?.phone || null,
  }], token).catch(() => [null]);
  return normalizeUser(authUser, createdClient);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    supabaseRest.getUser(token)
      .then((authUser) => loadProfile(authUser, token))
      .then((profileUser) => {
        setUser(profileUser);
      })
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    try {
      const data = await supabaseRest.signIn(email, password);
      const token = data.access_token;
      const profileUser = await loadProfile(data.user, token);
      if (profileUser.is_active === false) throw new Error('This account is disabled.');
      setToken(token, data.refresh_token || '');
      setUser(profileUser);
      return { ok: true, user: profileUser };
    } catch (e) {
      return { ok: false, error: e.message || 'Login failed' };
    }
  };

  const register = async (full_name, email, password, phone, phoneCode = '+971') => {
    try {
      // Use our backend bridge which auto-confirms the email (no SMTP in Supabase).
      const API = process.env.REACT_APP_BACKEND_URL;
      const resp = await fetch(`${API}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name, phone: (phone || '').trim(), phone_country_code: phoneCode }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || data.msg || data.error_description || 'Registration failed');
      const token = data.access_token;
      if (token && data.user) {
        const [profile] = await supabaseRest.insert('profiles', [{
          id: data.user.id,
          email,
          full_name,
          role: 'client',
        }], token).catch(() => [null]);
        const profileUser = normalizeUser(data.user, profile);
        setToken(token, data.refresh_token || '');
        setUser(profileUser);
        return { ok: true, user: profileUser };
      }
      return { ok: true, user: { email, name: full_name, role: 'client' } };
    } catch (e) {
      return { ok: false, error: e.message || 'Registration failed' };
    }
  };

  const loginWithToken = async (token, refreshToken = '') => {
    try {
      const authUser = await supabaseRest.getUser(token);
      const profileUser = await loadProfile(authUser, token);
      if (profileUser.is_active === false) throw new Error('This account is disabled.');
      setToken(token, refreshToken);
      setUser(profileUser);
      return { ok: true, user: profileUser };
    } catch (e) {
      return { ok: false, error: e.message || 'Could not complete sign-in' };
    }
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, register, logout, loginWithToken }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
