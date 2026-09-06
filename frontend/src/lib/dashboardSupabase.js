// Supabase-backed dashboard helpers (Phase 16 / Iteration 9).
// Tables: public.kyc_documents, public.memberships — see /app/supabase/migrations/0001_dashboard_tables.sql
// RLS: row visibility scoped by auth.jwt() ->> 'email' = user_email.
// All requests are sent with the user's Supabase JWT (anon key fallback for unauth).

import { supabaseRest } from './supabaseRest';
import { getToken } from './authTokenStorage';

const ssuToken = getToken;

const safe = (v) => String(v || '').toLowerCase().trim();

/* ----- KYC ----- */
export async function listKycDocs(email) {
  if (!email) return [];
  try {
    const q = `?select=*&user_email=eq.${encodeURIComponent(safe(email))}`;
    return (await supabaseRest.select('kyc_documents', q, ssuToken())) || [];
  } catch (e) {
    console.warn('[dashboard] kyc list failed:', e?.message);
    return [];
  }
}

export async function upsertKycDoc(email, doc) {
  // doc: { doc_key, file_name, file_size_bytes, file_b64 }
  const payload = [{
    user_email: safe(email),
    doc_key: doc.doc_key,
    file_name: doc.file_name,
    file_size_bytes: doc.file_size_bytes || 0,
    file_b64: doc.file_b64 || null,
    uploaded_at: new Date().toISOString(),
  }];
  return supabaseRest.upsert('kyc_documents', payload, ssuToken());
}

export async function deleteKycDoc(email, docKey) {
  const q = `?user_email=eq.${encodeURIComponent(safe(email))}&doc_key=eq.${encodeURIComponent(docKey)}`;
  return supabaseRest.remove('kyc_documents', q, ssuToken());
}

/* ----- MEMBERSHIPS ----- */
export async function getMembership(email, plan = 'founder_club') {
  if (!email) return null;
  try {
    const q = `?select=*&user_email=eq.${encodeURIComponent(safe(email))}&plan=eq.${encodeURIComponent(plan)}&active=eq.true&limit=1`;
    const rows = await supabaseRest.select('memberships', q, ssuToken());
    return rows?.[0] || null;
  } catch (e) {
    console.warn('[dashboard] membership get failed:', e?.message);
    return null;
  }
}

export async function activateMembership(email, plan = 'founder_club', orderReference = null) {
  const payload = [{
    user_email: safe(email),
    plan,
    active: true,
    joined_at: new Date().toISOString(),
    order_reference: orderReference,
  }];
  return supabaseRest.upsert('memberships', payload, ssuToken());
}
