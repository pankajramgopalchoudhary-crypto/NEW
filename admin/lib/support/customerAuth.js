// Resolves the caller of a customer-facing support request from a Supabase JWT.
// Port of backend/support.py::_resolve_caller_role.
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const ANON = { id: '', email: '', role: 'anon' };
const STAFF_ROLES = ['admin', 'manager', 'staff', 'reviewer', 'founder'];

export function isStaff(role) {
  return STAFF_ROLES.includes(String(role || '').toLowerCase());
}

export async function resolveCaller(request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return ANON;
  const token = header.slice(7);
  try {
    const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!u.ok) return ANON;
    const user = await u.json();
    const id = user?.id || '';
    const email = user?.email || '';
    const p = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=role&id=eq.${id}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      cache: 'no-store',
    });
    const rows = p.ok ? await p.json() : [];
    const role = String(rows?.[0]?.role || 'client').toLowerCase();
    return { id, email, role };
  } catch {
    return ANON;
  }
}
