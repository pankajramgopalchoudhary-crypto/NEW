// Admin CRUD helpers (Phase 17 / Iteration 10)
import { supabaseRest } from './supabaseRest';
import { getToken } from './authTokenStorage';

const token = getToken;

/* ---- Coupons ---- */
export const listCoupons = () =>
  supabaseRest.select('coupons', '?select=*&order=created_at.desc', token()).catch(() => []);

export const createCoupon = (row) =>
  supabaseRest.insert('coupons', [{ ...row, code: String(row.code).toUpperCase() }], token());

export const updateCoupon = (id, patch) =>
  supabaseRest.update('coupons', { ...patch, updated_at: new Date().toISOString() }, `?id=eq.${id}`, token());

export const deleteCoupon = (id) =>
  supabaseRest.remove('coupons', `?id=eq.${id}`, token());

/* ---- Orders ---- */
export const updateOrderStatus = (id, status, notes = null) =>
  supabaseRest.update('checkout_orders', { status, ...(notes ? { notes } : {}) }, `?id=eq.${id}`, token());

/* ---- Leads ---- */
export const updateLeadStatus = (id, status) =>
  supabaseRest.update('leads', { status }, `?id=eq.${id}`, token());

/* ---- Memberships (admin view all) ---- */
export const listAllMemberships = () =>
  supabaseRest.select('memberships', '?select=*&order=joined_at.desc&limit=200', token()).catch(() => []);

export const setMembershipActive = (id, active) =>
  supabaseRest.update('memberships', { active }, `?id=eq.${id}`, token());

/* ---- KYC (admin view all) ---- */
export const listAllKyc = () =>
  supabaseRest.select('kyc_documents', '?select=id,user_email,doc_key,file_name,file_size_bytes,uploaded_at&order=uploaded_at.desc&limit=200', token()).catch(() => []);

/* ---- CSV utility ---- */
export function downloadCsv(filename, rows) {
  if (!rows?.length) return;
  const cols = Object.keys(rows[0]);
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => escape(r[c])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
