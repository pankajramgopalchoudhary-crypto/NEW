// Server-side Supabase REST client (service role).
// NEVER import this in client components.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const baseHeaders = () => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
});

export async function sbGet(table, query = '', { count = false } = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query ? '?' + query : ''}`;
  const headers = baseHeaders();
  if (count) headers['Prefer'] = 'count=exact';
  const r = await fetch(url, { headers, cache: 'no-store' });
  const data = r.ok ? await r.json() : [];
  const totalCount = count ? Number((r.headers.get('content-range') || '*/0').split('/')[1]) || 0 : null;
  return { ok: r.ok, status: r.status, data, count: totalCount };
}

export async function sbPost(table, body, prefer = 'return=representation') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...baseHeaders(), Prefer: prefer },
    body: JSON.stringify(body),
  });
  const data = r.ok ? await r.json() : await r.text();
  return { ok: r.ok, status: r.status, data };
}

export async function sbPatch(table, query, body, prefer = 'return=representation') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: { ...baseHeaders(), Prefer: prefer },
    body: JSON.stringify(body),
  });
  const data = r.ok ? (r.status === 204 ? null : await r.json()) : await r.text();
  return { ok: r.ok, status: r.status, data };
}

export async function sbDelete(table, query) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: baseHeaders(),
  });
  return { ok: r.ok, status: r.status };
}

export async function sbUpsert(table, body, onConflict) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: { ...baseHeaders(), Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(body),
  });
  const data = r.ok ? await r.json() : await r.text();
  return { ok: r.ok, status: r.status, data };
}
