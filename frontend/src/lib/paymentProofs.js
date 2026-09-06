// Admin: list, sign URL and verify payment proofs from Supabase.
const SUPA = process.env.REACT_APP_SUPABASE_URL;
const KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

function headers(token) {
  return {
    apikey: KEY,
    Authorization: `Bearer ${token || KEY}`,
    'Content-Type': 'application/json',
  };
}

export async function listPaymentProofs({ token, status } = {}) {
  const url = new URL(`${SUPA}/rest/v1/payment_proofs`);
  url.searchParams.set('select', '*');
  url.searchParams.set('order', 'uploaded_at.desc');
  url.searchParams.set('limit', '500');
  if (status) url.searchParams.set('status', `eq.${status}`);
  const r = await fetch(url, { headers: headers(token) });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  return r.json();
}

export async function signProofUrl({ token, path, expiresIn = 600 }) {
  const r = await fetch(`${SUPA}/storage/v1/object/sign/payment-proofs/${path}?expiresIn=${expiresIn}`, {
    method: 'POST',
    headers: headers(token),
  });
  if (!r.ok) throw new Error(`Sign URL ${r.status}`);
  const { signedURL } = await r.json();
  return `${SUPA}/storage/v1${signedURL}`;
}

export async function updateProofStatus({ token, id, status, reviewer }) {
  const r = await fetch(`${SUPA}/rest/v1/payment_proofs?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...headers(token), Prefer: 'return=representation' },
    body: JSON.stringify({ status, reviewed_by: reviewer, reviewed_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(`Update ${r.status}`);
  return r.json();
}
