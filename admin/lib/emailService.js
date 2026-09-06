// lib/emailService.js
// Multi-alias email routing service for smartsetupuae.ae
// Replaces the simple lib/email.js with a full routing + logging layer.
// All business logic must send emails through sendEmail() — never call Resend directly.

import { col } from '@/lib/mongo';

// ─── Alias config ────────────────────────────────────────────────────────────

const EMAIL_CONFIGS = {
  account: {
    fromName: 'SmartSetupUAE Account',
    fromEmail: 'account@smartsetupuae.ae',
    replyTo: 'support@smartsetupuae.ae',
    priority: 'normal',
    description: 'General account & system notifications',
  },
  compliance: {
    fromName: 'SmartSetupUAE Compliance',
    fromEmail: 'compliance@smartsetupuae.ae',
    replyTo: 'compliance@smartsetupuae.ae',
    priority: 'high',
    description: 'Legal, regulatory & tax updates',
  },
  foundersclub: {
    fromName: 'SmartSetupUAE Founders Club',
    fromEmail: 'foundersclub@smartsetupuae.ae',
    replyTo: 'foundersclub@smartsetupuae.ae',
    priority: 'high',
    description: 'VIP & Founders Club communications',
  },
  noreply: {
    fromName: 'SmartSetupUAE',
    fromEmail: 'noreply@smartsetupuae.ae',
    replyTo: 'support@smartsetupuae.ae',   // fallback so replies don't bounce
    priority: 'normal',
    description: 'System emails: OTP, alerts, automated messages',
  },
  sales: {
    fromName: 'SmartSetupUAE Sales',
    fromEmail: 'sales@smartsetupuae.ae',
    replyTo: 'sales@smartsetupuae.ae',
    priority: 'normal',
    description: 'Lead generation & commercial communications',
  },
  support: {
    fromName: 'SmartSetupUAE Support',
    fromEmail: 'support@smartsetupuae.ae',
    replyTo: 'support@smartsetupuae.ae',
    priority: 'normal',
    description: 'Customer support & ticket notifications',
  },
  visa: {
    fromName: 'SmartSetupUAE Visa',
    fromEmail: 'visa@smartsetupuae.ae',
    replyTo: 'visa@smartsetupuae.ae',
    priority: 'high',
    description: 'Visa case updates & immigration communications',
  },
};

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Returns the routing config for a given alias type.
 * @param {'account'|'compliance'|'foundersclub'|'noreply'|'sales'|'support'|'visa'} type
 */
export function getEmailConfig(type) {
  const cfg = EMAIL_CONFIGS[type];
  if (!cfg) throw new Error(`Unknown email type: "${type}". Valid types: ${Object.keys(EMAIL_CONFIGS).join(', ')}`);
  return cfg;
}

/**
 * Sends an email via Resend using the correct alias and logs the result to MongoDB.
 *
 * @param {{
 *   type: keyof EMAIL_CONFIGS,
 *   to: string | string[],
 *   subject: string,
 *   html: string,
 *   text?: string,
 *   replyToOverride?: string,
 *   userId?: string,
 *   relatedModule?: string,
 * }} opts
 * @returns {Promise<{ success: boolean, message: string, messageId?: string }>}
 */
export async function sendEmail({
  type,
  to,
  subject,
  html,
  text,
  replyToOverride,
  userId,
  relatedModule,
}) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) {
    console.warn('[emailService] RESEND_API_KEY missing — skipping send');
    return { success: false, message: 'RESEND_API_KEY not configured' };
  }

  const cfg = getEmailConfig(type);
  const recipients = Array.isArray(to) ? to : [to];
  const fromField = `${cfg.fromName} <${cfg.fromEmail}>`;
  const replyTo = replyToOverride || cfg.replyTo;

  let status = 'failed';
  let provider_message_id = null;
  let errorMessage = null;

  try {
    const body = {
      from: fromField,
      to: recipients,
      subject,
      html,
      ...(text ? { text } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
    };

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      status = 'sent';
      provider_message_id = data?.id || null;
    } else {
      errorMessage = data?.message || `Resend ${res.status}`;
      console.error('[emailService] Resend rejected:', data);
    }
  } catch (err) {
    errorMessage = String(err?.message || err);
    console.error('[emailService] send threw:', err);
  }

  // ── Log to MongoDB ──────────────────────────────────────────────────────────
  try {
    const logs = await col('email_logs');
    await logs.insertOne({
      to: recipients,
      from: cfg.fromEmail,
      fromName: cfg.fromName,
      type,
      subject,
      status,
      provider_message_id,
      error: errorMessage,
      userId: userId || null,
      relatedModule: relatedModule || null,
      timestamp: new Date(),
    });
  } catch (logErr) {
    // Never let logging failure break the response
    console.error('[emailService] failed to write email_log:', logErr);
  }

  if (status === 'sent') {
    return { success: true, message: 'Email sent', messageId: provider_message_id };
  }
  return { success: false, message: errorMessage || 'Email send failed' };
}

// ─── Convenience wrappers (optional, for common templates) ───────────────────

/** Sends a system OTP / alert via noreply@ */
export function sendSystemEmail(opts) {
  return sendEmail({ ...opts, type: 'noreply', relatedModule: opts.relatedModule || 'system' });
}

/** Sends a support ticket notification via support@ */
export function sendSupportEmail(opts) {
  return sendEmail({ ...opts, type: 'support', relatedModule: opts.relatedModule || 'support' });
}

/** Sends a visa update via visa@ */
export function sendVisaEmail(opts) {
  return sendEmail({ ...opts, type: 'visa', relatedModule: opts.relatedModule || 'visa' });
}

// ─── Re-export old helpers so existing code keeps working ────────────────────
// (staffWelcomeEmail and pinResetEmail stay in lib/email.js; call them like before
//  but route the actual send through sendEmail({ type:'account', ... }) instead
//  of the raw fetch in lib/email.js)
