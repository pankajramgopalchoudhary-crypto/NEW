export function formatApiError(err) {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.message || 'Something went wrong.';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => (d && typeof d.msg === 'string' ? d.msg : JSON.stringify(d))).join(' ');
  }
  return String(detail);
}

export const api = {
  get() { throw new Error('Backend API client disabled. Use Supabase services in src/lib instead.'); },
  post() { throw new Error('Backend API client disabled. Use Supabase services in src/lib instead.'); },
  patch() { throw new Error('Backend API client disabled. Use Supabase services in src/lib instead.'); },
  put() { throw new Error('Backend API client disabled. Use Supabase services in src/lib instead.'); },
  delete() { throw new Error('Backend API client disabled. Use Supabase services in src/lib instead.'); },
};
