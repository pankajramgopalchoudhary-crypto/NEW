// Email delivery via Resend.
// Used to send PINs / passwords / KYC notifications to staff and clients.

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM_EMAIL || 'SmartSetupUAE <onboarding@resend.dev>';

export async function sendEmail({ to, subject, html, text }) {
  if (!RESEND_KEY) {
    console.warn('[email] RESEND_API_KEY missing; skipping send');
    return { ok: false, skipped: true, error: 'no_resend_key' };
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to: Array.isArray(to) ? to : [to], subject, html, text }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('[email] resend rejected:', data);
    }
    return { ok: r.ok, status: r.status, data, error: !r.ok ? (data?.message || `resend ${r.status}`) : undefined };
  } catch (e) {
    console.error('[email] send failed', e);
    return { ok: false, error: String(e.message || e) };
  }
}

export function staffWelcomeEmail({ full_name, username, email, role, pin, password, loginUrl }) {
  const usingPin = ['staff', 'reviewer'].includes(role);
  const credLine = usingPin
    ? `<tr><td style="padding:6px 0;color:#64748b;width:120px;font-size:13px">PIN:</td><td style="padding:6px 0;color:#0A3D34;font-weight:700;font-size:18px;font-family:monospace;letter-spacing:0.2em">${pin}</td></tr>`
    : `<tr><td style="padding:6px 0;color:#64748b;width:120px;font-size:13px">Password:</td><td style="padding:6px 0;color:#0A3D34;font-weight:700;font-size:14px;font-family:monospace">${password}</td></tr>`;

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F5F7FA;font-family:'Poppins',Arial,sans-serif;color:#1a1a1a">
  <div style="max-width:560px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:linear-gradient(135deg,#0A3D34,#062A24);padding:28px;text-align:center">
      <div style="color:white;font-size:22px;font-weight:800;letter-spacing:0.02em">
        SMARTSETUP<span style="color:#D4AF37">UAE</span>
      </div>
      <div style="color:#D4AF37;font-size:10px;letter-spacing:0.3em;margin-top:6px;font-weight:600">SETUP SMART. GROW FAST.</div>
    </div>
    <div style="padding:32px">
      <h1 style="font-size:20px;color:#0A3D34;margin:0 0 8px">Welcome, ${full_name}!</h1>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px">
        You’ve been added to the SmartSetupUAE admin team as a <strong style="color:#0A3D34;text-transform:capitalize">${role}</strong>. Your credentials are below.
      </p>
      <div style="background:#fdf6e3;border:1px solid #D4AF37;border-radius:12px;padding:20px;margin:16px 0">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#64748b;width:120px;font-size:13px">${usingPin ? 'Username' : 'Email'}:</td><td style="padding:6px 0;color:#0A3D34;font-weight:700;font-size:14px">${usingPin ? username : email}</td></tr>
          ${credLine}
          <tr><td style="padding:6px 0;color:#64748b;width:120px;font-size:13px">Role:</td><td style="padding:6px 0;color:#0A3D34;font-weight:600;text-transform:capitalize">${role}</td></tr>
        </table>
      </div>
      <p style="color:#475569;font-size:13px;margin:20px 0 8px">
        <strong>Important:</strong> Please change your ${usingPin ? 'PIN' : 'password'} after first login in <em>Settings</em>.
      </p>
      <div style="text-align:center;margin:28px 0 8px">
        <a href="${loginUrl}" style="background:#0A3D34;color:white;text-decoration:none;padding:12px 32px;border-radius:10px;font-weight:600;font-size:14px;display:inline-block">Sign in →</a>
      </div>
    </div>
    <div style="background:#F5F7FA;padding:16px 32px;font-size:11px;color:#94a3b8;text-align:center">
      Axiscrest Global FZE LLC · Lic: 262843696888<br/>
      If you didn’t expect this email, ignore it.
    </div>
  </div>
</body></html>`;

  const text = `Welcome ${full_name}! You're now a ${role} on SmartSetupUAE.\n${usingPin ? `Username: ${username}\nPIN: ${pin}` : `Email: ${email}\nPassword: ${password}`}\nLogin: ${loginUrl}\nPlease change credentials after first login.`;

  return { subject: `Welcome to SmartSetupUAE — your ${role} access`, html, text };
}

export function pinResetEmail({ full_name, username, pin, loginUrl }) {
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F5F7FA;font-family:'Poppins',Arial,sans-serif">
  <div style="max-width:520px;margin:32px auto;background:white;border-radius:16px;padding:32px;border:1px solid #e2e8f0">
    <h1 style="color:#0A3D34;font-size:20px;margin:0 0 12px">Your PIN has been reset</h1>
    <p style="color:#475569;font-size:14px">Hi ${full_name}, your access PIN was reset by an administrator.</p>
    <div style="background:#fdf6e3;border:1px solid #D4AF37;border-radius:12px;padding:20px;margin:20px 0;text-align:center">
      <div style="color:#64748b;font-size:11px;letter-spacing:0.2em;text-transform:uppercase">New PIN</div>
      <div style="font-family:monospace;font-size:32px;font-weight:700;letter-spacing:0.4em;color:#0A3D34;margin-top:8px">${pin}</div>
    </div>
    <p style="color:#475569;font-size:13px">Username: <strong>${username}</strong></p>
    <div style="text-align:center;margin-top:24px"><a href="${loginUrl}" style="background:#0A3D34;color:white;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:14px;display:inline-block">Sign in →</a></div>
  </div>
</body></html>`;
  return { subject: 'Your SmartSetupUAE PIN was reset', html, text: `New PIN: ${pin}. Login: ${loginUrl}` };
}
