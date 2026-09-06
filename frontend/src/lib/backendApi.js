/**
 * Helper for talking to /api/* endpoints (FastAPI backend).
 * - REACT_APP_BACKEND_URL is mandatory (no fallback).
 * - Auto-attaches Supabase JWT for auth'd endpoints.
 */
import { getToken } from './authTokenStorage';

const BASE = process.env.REACT_APP_BACKEND_URL;
if (!BASE) {
  // eslint-disable-next-line no-console
  console.error('REACT_APP_BACKEND_URL is not set');
}

async function call(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const tok = getToken();
    if (tok) headers.Authorization = `Bearer ${tok}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const txt = await res.text();
  let json;
  try { json = txt ? JSON.parse(txt) : {}; } catch { json = { raw: txt }; }
  if (!res.ok) {
    const err = new Error(json?.detail || json?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json;
}

export const api = {
  get: (p, opts) => call(p, { ...opts, method: 'GET' }),
  post: (p, body, opts) => call(p, { ...opts, method: 'POST', body }),
  put: (p, body, opts) => call(p, { ...opts, method: 'PUT', body }),
  patch: (p, body, opts) => call(p, { ...opts, method: 'PATCH', body }),
  delete: (p, opts) => call(p, { ...opts, method: 'DELETE' }),
};

// Convenience wrappers
export const lifecycleApi = {
  getProgressSteps: () => api.get('/api/lifecycle/progress/steps', { auth: false }),
  getProgress:  (order_ref) => api.get(`/api/lifecycle/progress?order_ref=${encodeURIComponent(order_ref)}`),
  updateProgress: (order_ref, payload) =>
    api.patch(`/api/lifecycle/progress?order_ref=${encodeURIComponent(order_ref)}`, payload),
  listAppointments: () => api.get('/api/lifecycle/appointments'),
  getProfile:  () => api.get('/api/lifecycle/profile'),
  putProfile:  (data) => api.put('/api/lifecycle/profile', data),
  listVault:   () => api.get('/api/lifecycle/vault'),
  addVault:    (entry) => api.post('/api/lifecycle/vault', entry),
  deleteVault: (id) => api.delete(`/api/lifecycle/vault/${id}`),
  getCompliance: () => api.get('/api/lifecycle/compliance'),
  putCompliance: (c) => api.put('/api/lifecycle/compliance', c),
  listRenewals: () => api.get('/api/lifecycle/renewals'),
  listInvoices: () => api.get('/api/lifecycle/invoices'),
  golden: (lead) => api.post('/api/lifecycle/golden-visa/lead', lead, { auth: false }),
};

export const ocrApi = {
  types: () => api.get('/api/ocr/types', { auth: false }),
  parse: (doc_type, image_base64, mime_type) =>
    api.post('/api/ocr/parse', { doc_type, image_base64, mime_type }, { auth: false }),
};

export const paymentsApi = {
  currencies: () => api.get('/api/payments/currencies', { auth: false }),
  createSession: (payload) => api.post('/api/payments/checkout/session', payload, { auth: false }),
  status: (session_id) => api.get(`/api/payments/checkout/status/${session_id}`, { auth: false }),
};

export const adminApi = {
  stats: () => api.get('/api/admin/dashboard/stats'),
  seedDummy: () => api.post('/api/admin/seed/dummy', {}),
  cleanupDummy: () => api.delete('/api/admin/seed/cleanup'),
  listGoldenVisaLeads: () => api.get('/api/lifecycle/golden-visa/leads'),
  listUsers: () => api.get('/api/admin/users'),
  updateUser: (payload) => api.patch('/api/admin/users', payload),
};

export default api;
