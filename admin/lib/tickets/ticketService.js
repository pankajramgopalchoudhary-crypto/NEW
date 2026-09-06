// lib/tickets/ticketService.js
// UNIFIED ticket service — operates on the SAME store the customer support
// portal (FastAPI /api/support) uses: Mongo `support_tickets` + `support_messages`.
// This makes every customer-raised ticket manageable from the admin panel.
//
// Backend statuses are open | in_progress | resolved | closed.
// The admin UI speaks open | pending | resolved | closed, so we map
// in_progress <-> pending at the boundary.

import { col } from '@/lib/mongo';
import { sendSupportEmail } from '@/lib/emailService';

const TICKETS = 'support_tickets';
const MESSAGES = 'support_messages';

const nowIso = () => new Date().toISOString();
const toAdminStatus = (s) => (s === 'in_progress' ? 'pending' : s);
const toBackendStatus = (s) => (s === 'pending' ? 'in_progress' : s);

// ─── Serialisers ───────────────────────────────────────────────────────────────

function shapeMessages(rows = []) {
  const messages = [];
  const internalNotes = [];
  for (const m of rows) {
    if (m.from_role === 'internal') {
      internalNotes.push({ note: m.body, adminName: m.from_email || 'Admin', timestamp: m.created_at });
    } else {
      messages.push({
        sender: ['agent', 'aria', 'system'].includes(m.from_role) ? 'admin' : 'user',
        from_role: m.from_role,
        message: m.body,
        timestamp: m.created_at,
        attachments: Array.isArray(m.attachments) ? m.attachments : [],
      });
    }
  }
  return { messages, internalNotes };
}

function shapeTicket(t, msgRows = []) {
  if (!t) return null;
  const { messages, internalNotes } = shapeMessages(msgRows);
  return {
    ticketId: t.ticket_number || t.reference || t._id,
    _id: t._id,
    name: t.customer_name || '',
    email: t.customer_email || '',
    subject: t.subject || '',
    status: toAdminStatus(t.status || 'open'),
    priority: t.priority || 'medium',
    category: t.category || 'general',
    source: t.channel || 'web',
    assignedTo: t.assigned_to || null,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    resolvedAt: t.resolved_at || null,
    firstResponseAt: t.first_response_at || null,
    messages,
    internalNotes,
    ai_suggestion: t.ai_suggestion || null,
    ai_status: t.ai_status || 'none',
    ai_confidence: t.ai_confidence ?? null,
    requires_human: !!t.requires_human,
    renewal: t.renewal || null,
  };
}

async function resolveTicket(idOrNumber) {
  const tickets = await col(TICKETS);
  return tickets.findOne({ $or: [{ _id: idOrNumber }, { ticket_number: idOrNumber }, { reference: idOrNumber }] });
}

// ─── ID Generator (shared SUP-###### counter) ──────────────────────────────────

export async function generateTicketId() {
  const counters = await col('counters');
  const result = await counters.findOneAndUpdate(
    { _id: 'support_ticket_seq' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const seq = result?.seq ?? result?.value?.seq ?? 1;
  return `SUP-${String(seq).padStart(6, '0')}`;
}

// ─── Create ─────────────────────────────────────────────────────────────────────

export async function createTicket(data) {
  const {
    name, email, subject, message,
    category = 'general', priority = 'medium', userId = null, source = 'form',
  } = data;
  if (!name || !email || !subject || !message) {
    throw new Error('name, email, subject and message are required');
  }

  const tickets = await col(TICKETS);
  const messages = await col(MESSAGES);
  const _id = (globalThis.crypto?.randomUUID?.() || `${Date.now()}${Math.random()}`).replace(/-/g, '').slice(0, 12).toUpperCase();
  const ticketNumber = await generateTicketId();
  const now = nowIso();

  const doc = {
    _id, ticket_number: ticketNumber, reference: ticketNumber,
    subject: String(subject).slice(0, 200), channel: source, priority, category,
    status: 'open', customer_email: String(email).toLowerCase(), customer_name: name,
    phone: data.phone || '', related_url: data.related_url || '',
    assigned_to: '', supabase_user_id: userId || '',
    created_at: now, updated_at: now,
    first_response_at: '', resolved_at: '', sla_state: 'healthy',
    sla_policy_id: null, first_response_due: null, resolution_due: null,
    sla_paused_at: null, total_paused_seconds: 0,
    ai_status: 'none', ai_confidence: null, requires_human: false,
  };
  await tickets.insertOne(doc);
  await messages.insertOne({
    ticket_id: _id, from_role: 'customer', from_email: doc.customer_email,
    body: String(message).slice(0, 4000), attachments: [], created_at: now,
  });

  await sendSupportEmail({
    to: email,
    subject: `We received your request — ${ticketNumber}`,
    html: ticketCreatedHtml({ name, ticketId: ticketNumber, subject, message }),
    userId, relatedModule: 'support',
  }).catch(() => {});

  return { ...shapeTicket(doc, []), ticketId: ticketNumber };
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function listTickets({ status, priority, category, assignedTo, search, page = 1, limit = 25 } = {}) {
  const tickets = await col(TICKETS);
  const query = {};
  if (status && status !== 'all') query.status = toBackendStatus(status);
  if (priority && priority !== 'all') query.priority = priority;
  if (category && category !== 'all') query.category = category;
  if (assignedTo) query.assigned_to = assignedTo;
  if (search) {
    const re = { $regex: search, $options: 'i' };
    query.$or = [{ customer_name: re }, { customer_email: re }, { subject: re }, { ticket_number: re }];
  }
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    tickets.find(query).sort({ updated_at: -1 }).skip(skip).limit(limit).toArray(),
    tickets.countDocuments(query),
  ]);
  return { tickets: items.map((t) => shapeTicket(t, [])), total, page, pages: Math.ceil(total / limit) };
}

export async function getTicket(ticketId) {
  const t = await resolveTicket(ticketId);
  if (!t) return null;
  const messages = await col(MESSAGES);
  const rows = await messages.find({ ticket_id: t._id }).sort({ created_at: 1 }).toArray();
  return shapeTicket(t, rows);
}

// ─── Reply ────────────────────────────────────────────────────────────────────

export async function replyToTicket({ ticketId, sender, message, attachments = [], adminName, userId }) {
  if (!message?.trim() && (!attachments || attachments.length === 0)) throw new Error('Message cannot be empty');
  const tickets = await col(TICKETS);
  const messages = await col(MESSAGES);
  const t = await resolveTicket(ticketId);
  if (!t) throw new Error(`Ticket ${ticketId} not found`);

  const now = nowIso();
  const isAdmin = sender === 'admin';
  await messages.insertOne({
    ticket_id: t._id,
    from_role: isAdmin ? 'agent' : 'customer',
    from_email: isAdmin ? (adminName || 'support') : t.customer_email,
    body: (message || '(attachment)').trim().slice(0, 4000),
    attachments: attachments || [],
    created_at: now,
  });

  const set = { updated_at: now };
  if (isAdmin && !t.first_response_at) set.first_response_at = now;
  if (isAdmin && t.status === 'open') set.status = 'in_progress';
  if (!isAdmin && t.status === 'resolved') set.status = 'in_progress';
  await tickets.updateOne({ _id: t._id }, { $set: set });

  if (isAdmin && t.customer_email) {
    await sendSupportEmail({
      to: t.customer_email,
      subject: `Update on your ticket ${t.ticket_number || t._id}: ${t.subject}`,
      html: ticketReplyHtml({ name: t.customer_name, ticketId: t.ticket_number || t._id, message, adminName }),
      userId: t.supabase_user_id, relatedModule: 'support',
    }).catch(() => {});
  }

  return getTicket(t.ticket_number || t._id);
}

// ─── Update status / assign ───────────────────────────────────────────────────

export async function updateTicketStatus({ ticketId, status }) {
  const VALID = ['open', 'pending', 'resolved', 'closed'];
  if (!VALID.includes(status)) throw new Error(`Invalid status: ${status}`);
  const tickets = await col(TICKETS);
  const t = await resolveTicket(ticketId);
  if (!t) throw new Error(`Ticket ${ticketId} not found`);

  const now = nowIso();
  const set = { status: toBackendStatus(status), updated_at: now };
  if (status === 'resolved' || status === 'closed') set.resolved_at = now;
  await tickets.updateOne({ _id: t._id }, { $set: set });

  if ((status === 'resolved' || status === 'closed') && t.customer_email) {
    await sendSupportEmail({
      to: t.customer_email,
      subject: `Your ticket ${t.ticket_number || t._id} has been ${status}`,
      html: ticketStatusHtml({ name: t.customer_name, ticketId: t.ticket_number || t._id, subject: t.subject, status }),
      userId: t.supabase_user_id, relatedModule: 'support',
    }).catch(() => {});
  }
  return { ok: true, status };
}

export async function assignTicket({ ticketId, assignedTo }) {
  const tickets = await col(TICKETS);
  const t = await resolveTicket(ticketId);
  if (!t) throw new Error(`Ticket ${ticketId} not found`);
  await tickets.updateOne({ _id: t._id }, { $set: { assigned_to: assignedTo || '', updated_at: nowIso() } });
  return { ok: true, assignedTo };
}

export async function addInternalNote({ ticketId, note, adminId, adminName }) {
  const messages = await col(MESSAGES);
  const tickets = await col(TICKETS);
  const t = await resolveTicket(ticketId);
  if (!t) throw new Error(`Ticket ${ticketId} not found`);
  await messages.insertOne({
    ticket_id: t._id, from_role: 'internal',
    from_email: adminName || adminId || 'Admin', body: String(note).slice(0, 4000),
    attachments: [], created_at: nowIso(),
  });
  await tickets.updateOne({ _id: t._id }, { $set: { updated_at: nowIso() } });
  return { ok: true };
}

// ─── Stats ──────────────────────────────────────────────────────────────────────

export async function getTicketStats() {
  const tickets = await col(TICKETS);
  const [open, pending, resolved, closed, total] = await Promise.all([
    tickets.countDocuments({ status: 'open' }),
    tickets.countDocuments({ status: 'in_progress' }),
    tickets.countDocuments({ status: 'resolved' }),
    tickets.countDocuments({ status: 'closed' }),
    tickets.countDocuments({}),
  ]);
  return { open, pending, resolved, closed, total };
}

// ─── Support analytics (resolution time, SLA %, AI rates) ──────────────────────

export async function getSupportAnalytics(days = 30) {
  const win = Math.max(1, Math.min(Number(days) || 30, 365));
  const since = new Date(Date.now() - win * 86400000).toISOString();
  const tickets = await col(TICKETS);
  const logs = await col('ai_support_logs');

  const rows = await tickets.find({ created_at: { $gte: since } }).toArray();
  let resolved = 0, compliant = 0, breached = 0, aiAutoResolved = 0, escalated = 0;
  const resSecs = [], frSecs = [];
  const byStatus = {}, byCategory = {};
  const parse = (v) => (v ? new Date(v).getTime() : null);

  for (const t of rows) {
    const st = toAdminStatus(t.status || 'open');
    byStatus[st] = (byStatus[st] || 0) + 1;
    const cat = t.category || 'general';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    const created = parse(t.created_at);
    const fr = parse(t.first_response_at);
    if (created && fr) frSecs.push((fr - created) / 1000);
    const rat = parse(t.resolved_at);
    if (rat) {
      resolved += 1;
      if (created) resSecs.push((rat - created) / 1000);
      const due = parse(t.resolution_due);
      if (t.sla_state === 'breached' || (due && rat > due)) breached += 1; else compliant += 1;
    }
    if (t.ai_status === 'auto_replied') aiAutoResolved += 1;
    if (t.requires_human) escalated += 1;
  }

  const logRows = await logs.find({ created_at: { $gte: since } }).toArray();
  let aiTotal = 0, aiAuto = 0, aiSuggested = 0, aiEscalated = 0;
  for (const lg of logRows) {
    aiTotal += 1;
    const a = lg.action || '';
    if (a === 'auto_reply_eligible') aiAuto += 1;
    else if (a === 'suggested') aiSuggested += 1;
    else if (a.startsWith('escalated')) aiEscalated += 1;
  }

  const avgH = (arr) => (arr.length ? Math.round((arr.reduce((s, x) => s + x, 0) / arr.length / 3600) * 100) / 100 : 0);

  return {
    window_days: win,
    totals: { total: rows.length, resolved, open: rows.length - resolved, by_status: byStatus, by_category: byCategory },
    resolution: { avg_hours: avgH(resSecs), avg_first_response_hours: avgH(frSecs), resolved_count: resolved },
    sla: { compliant, breached, compliance_pct: resolved ? Math.round((compliant / resolved) * 1000) / 10 : 100 },
    ai: {
      suggestions_total: aiTotal, auto_replied: aiAuto, suggested_only: aiSuggested, escalated: aiEscalated,
      ai_resolution_rate_pct: aiTotal ? Math.round((aiAuto / aiTotal) * 1000) / 10 : 0,
      escalation_rate_pct: aiTotal ? Math.round((aiEscalated / aiTotal) * 1000) / 10 : 0,
    },
  };
}

// ─── Email templates ─────────────────────────────────────────────────────────

function baseLayout(inner) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F5F7FA;font-family:'Poppins',Arial,sans-serif;color:#1a1a1a">
  <div style="max-width:560px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:linear-gradient(135deg,#0A3D34,#062A24);padding:28px;text-align:center">
      <div style="color:white;font-size:22px;font-weight:800;letter-spacing:0.02em">SMARTSETUP<span style="color:#D4AF37">UAE</span></div>
      <div style="color:#D4AF37;font-size:10px;letter-spacing:0.3em;margin-top:6px;font-weight:600">SETUP SMART. GROW FAST.</div>
    </div>
    <div style="padding:32px">${inner}</div>
    <div style="background:#F5F7FA;padding:16px 32px;font-size:11px;color:#94a3b8;text-align:center">
      Axiscrest Global FZE LLC · Lic: 262843696888<br/>
      <a href="https://smartsetupuae.ae" style="color:#0A3D34">smartsetupuae.ae</a>
    </div>
  </div>
</body></html>`;
}

function ticketCreatedHtml({ name, ticketId, subject, message }) {
  return baseLayout(`
    <h1 style="font-size:20px;color:#0A3D34;margin:0 0 8px">We've received your request</h1>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px">
      Hi ${name}, thank you for reaching out. Our support team will get back to you shortly.
    </p>
    <div style="background:#fdf6e3;border:1px solid #D4AF37;border-radius:12px;padding:20px;margin:16px 0">
      <div style="color:#64748b;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px">Ticket Details</div>
      <div style="color:#0A3D34;font-weight:700;font-size:18px;margin-bottom:4px">${ticketId}</div>
      <div style="color:#475569;font-size:13px"><strong>Subject:</strong> ${subject}</div>
      <div style="color:#475569;font-size:13px;margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0">${message}</div>
    </div>
  `);
}

function ticketReplyHtml({ name, ticketId, message, adminName }) {
  return baseLayout(`
    <h1 style="font-size:20px;color:#0A3D34;margin:0 0 8px">New reply on ${ticketId}</h1>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 16px">
      Hi ${name}, ${adminName ? `<strong>${adminName}</strong> from our support team has replied to your ticket.` : 'our support team has replied to your ticket.'}
    </p>
    <div style="background:#f8fafc;border-left:4px solid #0A3D34;border-radius:0 12px 12px 0;padding:20px;margin:16px 0">
      <div style="color:#475569;font-size:14px;line-height:1.6">${String(message || '').replace(/\n/g, '<br/>')}</div>
    </div>
  `);
}

function ticketStatusHtml({ name, ticketId, subject, status }) {
  const color = status === 'resolved' ? '#10b981' : '#64748b';
  return baseLayout(`
    <h1 style="font-size:20px;color:#0A3D34;margin:0 0 8px">Ticket ${ticketId} — ${status}</h1>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 20px">
      Hi ${name}, your support ticket has been marked as
      <strong style="color:${color};text-transform:capitalize">${status}</strong>.
    </p>
    <div style="background:#fdf6e3;border:1px solid #D4AF37;border-radius:12px;padding:20px;margin:16px 0">
      <div style="color:#64748b;font-size:13px"><strong>Subject:</strong> ${subject}</div>
      <div style="color:#64748b;font-size:13px;margin-top:4px"><strong>Ticket ID:</strong> ${ticketId}</div>
    </div>
  `);
}
