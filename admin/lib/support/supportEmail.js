// Support email delivery + email_logs entry (Node port of
// backend/notifications.send_and_log_email, trimmed to what support needs).
import { randomUUID } from 'crypto';
import { col } from '@/lib/mongo';

const KEY = process.env.RESEND_API_KEY;
const FROM_SUPPORT = process.env.RESEND_FROM_SUPPORT
  || process.env.RESEND_FROM_EMAIL
  || 'SmartSetupUAE Support <support@smartsetupuae.ae>';

export async function sendSupportEmail({ to, subject, html, eventType, template, ticketId, supabaseUserId }) {
  if (!to) return { ok: false, skipped: true };
  let result = { ok: false, skipped: true, error: 'no_resend_key' };
  if (KEY) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM_SUPPORT, to: [to], subject, html }),
      });
      const data = await r.json().catch(() => ({}));
      result = { ok: r.ok, status: r.status, id: data?.id, error: r.ok ? undefined : (data?.message || `resend ${r.status}`) };
    } catch (e) {
      result = { ok: false, error: String(e.message || e) };
    }
  }
  try {
    const logs = await col('email_logs');
    await logs.insertOne({
      _id: randomUUID(),
      to, subject,
      event_type: eventType || 'support',
      template: template || null,
      ticket_id: ticketId || null,
      supabase_user_id: supabaseUserId || null,
      provider_id: result.id || null,
      status: result.ok ? 'sent' : 'failed',
      error: result.error || null,
      created_at: new Date().toISOString(),
    });
  } catch { /* logging is best-effort */ }
  return result;
}
