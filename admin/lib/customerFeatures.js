import { v4 as uuid } from 'uuid';
import { col } from './mongo';
import { sbGet, sbPost, sbPatch } from './supabase';

const now = () => new Date().toISOString();
const clean = ({ _id, ...rest }) => ({ id: String(_id || rest.id || uuid()), ...rest });

export async function listJobs() {
  const rows = await (await col('careers_jobs')).find({ is_active: true }).sort({ created_at: -1 }).toArray();
  return { jobs: rows.map(clean) };
}
export async function getJob(id) {
  const row = await (await col('careers_jobs')).findOne({ $or: [{ id }, { _id: id }], is_active: true });
  return row ? clean(row) : null;
}
export async function submitApplication(body) {
  const job = await getJob(String(body.job_id || ''));
  if (!job) throw new Error('Job not found or no longer active');
  const application = { id: uuid(), job_id: body.job_id, job_title: job.title || '', name: String(body.name || ''), email: String(body.email || '').toLowerCase(), phone: String(body.phone || ''), nationality: String(body.nationality || ''), years_experience: String(body.years_experience || ''), cover_letter: String(body.cover_letter || ''), resume_url: String(body.resume_url || ''), status: 'new', created_at: now() };
  await (await col('careers_applications')).insertOne(application);
  return { ok: true, application_id: application.id };
}

export async function referralLookup(code) {
  const row = await (await col('referral_codes')).findOne({ code: String(code || '').toUpperCase() }, { projection: { _id: 0, owner_email: 0 } });
  if (!row) return null;
  return { code: row.code, referee_discount_aed: 50, valid: true };
}
export async function attachReferral(body) {
  const code = String(body.code || '').toUpperCase().trim();
  const parent = await (await col('referral_codes')).findOne({ code });
  if (!parent) throw new Error('Invalid referral code');
  const email = String(body.referee_email || '').toLowerCase();
  if (parent.owner_email.toLowerCase() === email) throw new Error('Cannot refer yourself');
  const existing = await (await col('referrals')).findOne({ code, referee_email: email });
  if (existing) return { ok: true, already_attached: true, id: existing.id };
  const row = { id: uuid(), code, referrer_email: parent.owner_email, referee_email: email, referee_name: body.referee_name || '', status: 'signed_up', signed_up_at: now(), converted_at: null, reward_amount: 0, reward_kind: '' };
  await (await col('referrals')).insertOne(row);
  await (await col('referral_codes')).updateOne({ code }, { $inc: { total_invites: 1 } });
  return { ok: true, id: row.id, referee_discount_aed: 50 };
}
export async function referralMe(email, name = '') {
  const codes = await col('referral_codes');
  let row = await codes.findOne({ owner_email: email });
  if (!row) { row = { code: `${String(name || email.split('@')[0]).replace(/[^A-Za-z]/g, '').slice(0, 6).toUpperCase() || 'FOUNDER'}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, owner_email: email, owner_name: name, created_at: now(), total_invites: 0, total_converted: 0 }; await codes.insertOne(row); }
  const invites = await (await col('referrals')).countDocuments({ code: row.code });
  const converted = await (await col('referrals')).countDocuments({ code: row.code, status: 'converted' });
  const rewards = await (await col('referral_rewards')).find({ owner_email: email, redeemed: false }).toArray();
  return { code: row.code, share_url: `https://smartsetupuae.ae/?ref=${row.code}`, invites, converted, rewards: { earned_cashback_aed: rewards.filter((r) => r.kind === 'cashback').reduce((s, r) => s + Number(r.amount || 0), 0), available_percent_off: rewards.some((r) => r.kind === 'discount_percent') ? 5 : 0, items: rewards.map(clean) }, rules: { referrer_cashback_aed: 50, referrer_percent_off: 5, referee_cashback_aed: 50, valid_for: 'First paid order.' } };
}

export async function createTicket(body, userEmail = '') {
  const ticket = { id: uuid(), ticket_id: `TKT-${Date.now().toString(36).toUpperCase()}`, subject: String(body.subject || 'Support request'), category: String(body.category || 'general'), priority: String(body.priority || 'normal'), status: 'open', customer_email: String(body.customer_email || userEmail).toLowerCase(), customer_name: String(body.customer_name || ''), message: String(body.message || body.description || ''), messages: [], created_at: now(), updated_at: now() };
  await (await col('support_tickets')).insertOne(ticket);
  return clean(ticket);
}
export async function listTickets(email, query = {}) {
  const filter = query.mine === 'true' && email ? { customer_email: email.toLowerCase() } : {};
  const rows = await (await col('support_tickets')).find(filter).sort({ updated_at: -1 }).toArray();
  return { tickets: rows.map(clean) };
}
export async function getTicket(id) { const row = await (await col('support_tickets')).findOne({ $or: [{ id }, { ticket_id: id }, { _id: id }] }); return row ? clean(row) : null; }
export async function replyTicket(id, body, email) { const ticket = await getTicket(id); if (!ticket) throw new Error('Ticket not found'); const message = { id: uuid(), body: String(body.message || ''), sender_email: email, created_at: now() }; await (await col('support_tickets')).updateOne({ id: ticket.id }, { $push: { messages: message }, $set: { updated_at: now(), status: 'in_progress' } }); return { ok: true, message }; }

export async function lifecycleRead(collection, email, extra = {}) { const row = await (await col(collection)).findOne({ customer_email: email, ...extra }); return row ? clean(row) : { customer_email: email, ...extra }; }
export async function lifecycleWrite(collection, email, body, extra = {}) { const key = { customer_email: email, ...extra }; await (await col(collection)).updateOne(key, { $set: { ...body, ...key, updated_at: now() } }, { upsert: true }); return lifecycleRead(collection, email, extra); }
export async function lifecycleList(collection, email) { const rows = await (await col(collection)).find({ customer_email: email }).sort({ created_at: -1 }).toArray(); return rows.map(clean); }
export async function postLead(body) { const result = await sbPost('leads', { ...body, created_at: now() }); return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.data }; }
export async function ariaRank(body) { return { ok: true, ranked: [], query: body.query || body.activity || '' }; }
