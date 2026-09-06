import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { col } from '@/lib/mongo';
import { sbGet, sbPost, sbPatch, sbDelete, sbUpsert } from '@/lib/supabase';
import { chatWithAria } from '@/lib/aria';
import { sendEmail, staffWelcomeEmail, pinResetEmail } from '@/lib/email';
import {
  loginWithPassword,
  loginWithPin,
  issueToken,
  verifyToken,
  getSessionFromRequest,
  requireRole,
  auditLog,
  seedDefaultUsers,
} from '@/lib/auth';
import {
  createTicket, listTickets, getTicket, replyToTicket,
  updateTicketStatus, assignTicket, addInternalNote, getTicketStats, getSupportAnalytics,
} from '@/lib/tickets/ticketService';
import { sendEmail as sendRoutedEmail, getEmailConfig } from '@/lib/emailService';


const json = (data, status = 200, extraHeaders = {}) => {
  const r = NextResponse.json(data, { status });
  Object.entries(extraHeaders).forEach(([k, v]) => r.headers.set(k, v));
  r.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*');
  r.headers.set('Access-Control-Allow-Credentials', 'true');
  return r;
};

export async function OPTIONS() {
  const r = new NextResponse(null, { status: 200 });
  r.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*');
  r.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  r.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  r.headers.set('Access-Control-Allow-Credentials', 'true');
  return r;
}

const FREEZONES = ['ANCFZ', 'SPC', 'RAKEZ', 'IFZA', 'Meydan', 'SHAMS', 'DMCC', 'JAFZA', 'KIZAD', 'DAFZA'];

async function handle(request, { params }) {
  const { path = [] } = await params;
  const route = '/' + path.join('/');
  const method = request.method;

  try {
    // ============ HEALTH ============
    if (route === '/' || route === '/health') {
      return json({ ok: true, service: 'SmartSetupUAE Admin API', ts: new Date().toISOString() });
    }

    // ============ AUTH ============
    if (route === '/admin/auth/login' && method === 'POST') {
      const body = await request.json();
      const { email, password, role } = body || {};
      if (!email || !password) return json({ error: 'email and password required' }, 400);
      const result = await loginWithPassword(email, password, role);
      if (!result.ok) return json({ error: result.error }, 401);
      const token = issueToken(result.user);
      await auditLog({ sub: result.user.id, role: result.user.role, email: result.user.email }, 'login.password', { role });
      const r = json({
        ok: true,
        token,
        user: {
          id: result.user.id,
          email: result.user.email,
          username: result.user.username,
          role: result.user.role,
          name: result.user.full_name,
        },
      });
      r.headers.append('Set-Cookie', `ss_admin=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${8 * 3600}`);
      return r;
    }

    if (route === '/admin/auth/pin' && method === 'POST') {
      const body = await request.json();
      const { username, pin, role } = body || {};
      if (!username || !pin) return json({ error: 'username and pin required' }, 400);
      const result = await loginWithPin(username, pin, role);
      if (!result.ok) return json({ error: result.error }, 401);
      const token = issueToken(result.user);
      await auditLog({ sub: result.user.id, role: result.user.role, email: result.user.email }, 'login.pin', { username, role });
      const r = json({
        ok: true,
        token,
        user: {
          id: result.user.id,
          email: result.user.email,
          username: result.user.username,
          role: result.user.role,
          name: result.user.full_name,
        },
      });
      r.headers.append('Set-Cookie', `ss_admin=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${8 * 3600}`);
      return r;
    }

    if (route === '/admin/auth/me' && method === 'GET') {
      const session = await getSessionFromRequest(request);
      if (!session) return json({ error: 'unauthorized' }, 401);
      return json({ user: session });
    }

    if (route === '/admin/auth/logout' && method === 'POST') {
      const r = json({ ok: true });
      r.headers.append('Set-Cookie', 'ss_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
      return r;
    }

    if (route === '/admin/auth/change-password' && method === 'POST') {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const { current, next } = await request.json();
      const c = await col('admin_users');
      const user = await c.findOne({ id: auth.session.sub });
      if (!user) return json({ error: 'user not found' }, 404);
      if (user.password_hash) {
        const ok = await bcrypt.compare(current || '', user.password_hash);
        if (!ok) return json({ error: 'current password wrong' }, 400);
      }
      const hash = await bcrypt.hash(next, 10);
      await c.updateOne({ id: user.id }, { $set: { password_hash: hash, password_updated_at: new Date() } });
      await auditLog(auth.session, 'auth.change_password');
      return json({ ok: true });
    }

    // ============ STATS ============
    if (route === '/admin/stats/overview' && method === 'GET') {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);

      const [leads, prebookings, paid, docsPending, allMemberships, tiers] = await Promise.all([
        sbGet('leads', 'select=id', { count: true }),
        sbGet('checkout_orders', 'select=id&status=eq.payment_review', { count: true }),
        sbGet('checkout_orders', 'select=id,base_price,addons_total,final_total&status=eq.paid', { count: true }),
        sbGet('documents', 'select=id&status=eq.pending', { count: true }),
        sbGet('founder_club_memberships', 'select=tier_id,status&limit=2000'),
        sbGet('founder_club_tiers', 'select=id,slug,launch_slots_total'),
      ]);

      const totalRevenue = (paid.data || []).reduce((s, o) => s + Number(o.final_total ?? o.base_price ?? 0), 0);
      const preRevenue = await sbGet('checkout_orders', 'select=final_total,base_price&status=eq.payment_review');
      const preTotal = (preRevenue.data || []).reduce((s, o) => s + Number(o.final_total ?? o.base_price ?? 999), 0);

      const pioneerTier = (tiers.data || []).find(t => t.slug === 'pioneer');
      const annualTier = (tiers.data || []).find(t => t.slug === 'annual');
      const free_used = (allMemberships.data || []).filter(m => m.tier_id === pioneerTier?.id).length;
      const paid_used = (allMemberships.data || []).filter(m => m.tier_id && m.tier_id !== pioneerTier?.id).length;

      return json({
        total_leads: leads.count,
        prebookings: prebookings.count,
        paid_orders: paid.count,
        docs_pending: docsPending.count,
        revenue_paid: totalRevenue,
        revenue_prebook: preTotal,
        founder_free_used: free_used,
        founder_free_limit: pioneerTier?.launch_slots_total || 500,
        founder_paid_used: paid_used,
        founder_paid_limit: annualTier?.launch_slots_total || 500,
      });
    }

    if (route === '/admin/stats/by-zone' && method === 'GET') {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const r = await sbGet('leads', 'select=zone&limit=10000');
      const counts = {};
      (r.data || []).forEach(row => {
        const z = row.zone || 'Consultation';
        counts[z] = (counts[z] || 0) + 1;
      });
      const arr = Object.entries(counts).map(([zone, count]) => ({ zone, count })).sort((a, b) => b.count - a.count);
      return json({ zones: arr });
    }

    if (route === '/admin/stats/pipeline' && method === 'GET') {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const r = await sbGet('leads', 'select=status,lead_status&limit=10000');
      const buckets = { new: 0, contacted: 0, qualified: 0, won: 0, lost: 0 };
      (r.data || []).forEach(row => {
        const s = (row.status || row.lead_status || 'new').toLowerCase();
        if (buckets[s] !== undefined) buckets[s] += 1;
        else buckets.new += 1;
      });
      return json({ pipeline: buckets });
    }

    if (route === '/admin/stats/activities-count' && method === 'GET') {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const total = await sbGet('activities_master', 'select=id', { count: true });
      const active = await sbGet('activities_master', 'select=id&or=(is_active.is.null,is_active.eq.true)', { count: true });
      return json({ total: total.count, active: active.count });
    }

    // ============ LEADS ============
    if (route === '/admin/leads' && method === 'GET') {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const limit = url.searchParams.get('limit') || '500';
      let q = `select=*&order=created_at.desc&limit=${limit}`;
      if (status && status !== 'all') q += `&status=eq.${status}`;
      const r = await sbGet('leads', q);
      return json({ leads: r.data || [] });
    }

    if (route.startsWith('/admin/leads/') && method === 'PATCH') {
      const auth = await requireRole(request, 'founder', 'manager', 'staff');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const id = route.split('/').pop();
      const body = await request.json();
      const r = await sbPatch('leads', `id=eq.${id}`, body);
      if (!r.ok) return json({ error: r.data }, r.status);
      await auditLog(auth.session, 'lead.update', { id, ...body });
      return json({ ok: true, lead: Array.isArray(r.data) ? r.data[0] : r.data });
    }

    // ============ ORDERS ============
    if (route === '/admin/orders' && method === 'GET') {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const r = await sbGet('checkout_orders', 'select=*&order=created_at.desc&limit=500');
      return json({ orders: r.data || [] });
    }

    if (route.startsWith('/admin/orders/') && method === 'PATCH') {
      const auth = await requireRole(request, 'founder', 'manager', 'staff');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const id = route.split('/').pop();
      const body = await request.json();
      const r = await sbPatch('checkout_orders', `id=eq.${id}`, body);
      if (!r.ok) return json({ error: r.data }, r.status);
      await auditLog(auth.session, 'order.update', { id, ...body });
      return json({ ok: true, order: Array.isArray(r.data) ? r.data[0] : r.data });
    }

    // ============ CLIENTS (merged leads + orders by email/phone) ============
    if (route === '/admin/clients' && method === 'GET') {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const [leadsR, ordersR] = await Promise.all([
        sbGet('leads', 'select=*&order=created_at.desc&limit=2000'),
        sbGet('checkout_orders', 'select=*&order=created_at.desc&limit=2000'),
      ]);
      const byKey = {};
      (leadsR.data || []).forEach(l => {
        const key = (l.email || l.phone || l.id).toLowerCase();
        byKey[key] = byKey[key] || { key, name: l.name, email: l.email, phone: l.phone, zone: l.zone, source: 'Lead', orders: [], leads: [], total_value: 0, status: l.status || 'new' };
        byKey[key].leads.push(l);
      });
      (ordersR.data || []).forEach(o => {
        const key = (o.customer_email || o.customer_phone || o.id).toLowerCase();
        byKey[key] = byKey[key] || { key, name: o.customer_name, email: o.customer_email, phone: o.customer_phone, zone: o.freezone, source: 'Portal', orders: [], leads: [], total_value: 0, status: o.status };
        byKey[key].name = byKey[key].name || o.customer_name;
        byKey[key].zone = o.freezone || byKey[key].zone;
        byKey[key].source = 'Portal';
        byKey[key].status = o.status === 'paid' ? 'paid' : (o.status === 'payment_review' ? 'prebook' : byKey[key].status);
        byKey[key].total_value += Number(o.final_total ?? o.base_price ?? 0);
        byKey[key].orders.push(o);
      });
      const clients = Object.values(byKey).map(c => ({ ...c, applications: c.orders.length + c.leads.length }));
      return json({ clients, total_clients: clients.length, paid_orders: clients.filter(c => c.status === 'paid').length, pre_bookings: clients.filter(c => c.status === 'prebook').length });
    }

    // ============ DOCUMENTS / KYC ============
    if (route === '/admin/documents' && method === 'GET') {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      let q = 'select=*&order=created_at.desc&limit=500';
      if (status && status !== 'all') q += `&status=eq.${status}`;
      const r = await sbGet('documents', q);
      const counts = {};
      for (const s of ['pending', 'in_review', 'approved', 'rejected', 'resubmit_req']) {
        const c = await sbGet('documents', `select=id&status=eq.${s}`, { count: true });
        counts[s] = c.count;
      }
      return json({ documents: r.data || [], counts });
    }

    if (route.startsWith('/admin/documents/') && method === 'PATCH') {
      const auth = await requireRole(request, 'founder', 'manager', 'reviewer');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const id = route.split('/').pop();
      const body = await request.json();
      const update = { ...body, reviewed_by: auth.session.email, reviewed_at: new Date().toISOString() };
      const r = await sbPatch('documents', `id=eq.${id}`, update);
      if (!r.ok) return json({ error: r.data }, r.status);
      await auditLog(auth.session, 'document.review', { id, ...body });
      return json({ ok: true, document: Array.isArray(r.data) ? r.data[0] : r.data });
    }

    // ============ PAYMENTS ============
    if (route === '/admin/payments' && method === 'GET') {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      let q = 'select=*&order=created_at.desc&limit=500';
      if (status && status !== 'all') q += `&status=eq.${status}`;
      const r = await sbGet('payments', q);
      return json({ payments: r.data || [] });
    }

    if (route.startsWith('/admin/payments/') && method === 'PATCH') {
      const auth = await requireRole(request, 'founder', 'manager');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const id = route.split('/').pop();
      const body = await request.json();
      const r = await sbPatch('payments', `id=eq.${id}`, { ...body, reviewed_by: auth.session.email, reviewed_at: new Date().toISOString() });
      if (!r.ok) return json({ error: r.data }, r.status);
      await auditLog(auth.session, 'payment.review', { id, ...body });
      return json({ ok: true });
    }

    // ============ INVOICES (read-only, generated from orders) ============
    if (route === '/admin/invoices' && method === 'GET') {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const r = await sbGet('checkout_orders', 'select=*&order=created_at.desc&limit=500');
      const invoices = (r.data || []).map(o => ({
        invoice_ref: 'INV-UAE-' + String(o.id).slice(0, 6).toUpperCase(),
        order_id: o.id,
        client_name: o.customer_name,
        client_email: o.customer_email,
        zone: o.freezone,
        amount: Number(o.total_amount || o.base_price || 0),
        booking_type: o.booking_type === 'prebook' ? `Pre-booking AED ${o.total_amount || 999}` : 'Full Payment',
        date: o.created_at,
        status: o.status,
      }));
      return json({ invoices });
    }

    // ============ PRICING & PACKAGES ============
    if (route === '/admin/pricing' && method === 'GET') {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const r = await sbGet('freezone_packages', 'select=*&order=freezone.asc,base_price.asc&limit=2000');
      const byZone = {};
      (r.data || []).forEach(p => {
        const z = p.freezone;
        byZone[z] = byZone[z] || { freezone: z, without_visa: null, with_1_visa: null, with_2_visa: null, packages: [], is_active: true };
        byZone[z].packages.push(p);
        if ((p.visa_count || 0) === 0 && byZone[z].without_visa == null) byZone[z].without_visa = Number(p.base_price);
        if ((p.visa_count || 0) === 1 && byZone[z].with_1_visa == null) byZone[z].with_1_visa = Number(p.base_price);
        if ((p.visa_count || 0) === 2 && byZone[z].with_2_visa == null) byZone[z].with_2_visa = Number(p.base_price);
        if (p.is_active === false) byZone[z].is_active = false;
      });
      // Ensure all 10 freezones are present (add missing ones with zero pricing)
      for (const z of FREEZONES) {
        if (!byZone[z]) byZone[z] = { freezone: z, without_visa: 0, with_1_visa: 0, with_2_visa: 0, packages: [], is_active: false };
      }
      return json({ pricing: FREEZONES.map(z => byZone[z]) });
    }

    if (route === '/admin/pricing/bulk' && method === 'PATCH') {
      const auth = await requireRole(request, 'founder');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const { updates } = await request.json();
      const results = [];
      for (const u of updates || []) {
        for (const visaCount of [0, 1, 2]) {
          const key = visaCount === 0 ? 'without_visa' : `with_${visaCount}_visa`;
          const price = u[key];
          if (price == null || price === '') continue;
          // Try to update existing row for this zone+visa_count
          const existing = await sbGet('freezone_packages', `select=id&freezone=eq.${encodeURIComponent(u.freezone)}&visa_count=eq.${visaCount}&limit=1`);
          if (existing.data && existing.data.length) {
            await sbPatch('freezone_packages', `id=eq.${existing.data[0].id}`, { base_price: Number(price), is_active: true });
            results.push({ zone: u.freezone, visa_count: visaCount, action: 'updated' });
          } else {
            await sbPost('freezone_packages', {
              freezone: u.freezone,
              package_name: visaCount === 0 ? 'License Only' : `License + ${visaCount} Visa`,
              package_type: visaCount === 0 ? 'license' : 'license_visa',
              duration_years: 1,
              visa_count: visaCount,
              shareholder_count: 1,
              base_price: Number(price),
              currency: 'AED',
              is_active: true,
            });
            results.push({ zone: u.freezone, visa_count: visaCount, action: 'created' });
          }
        }
      }
      await auditLog(auth.session, 'pricing.bulk_update', { count: results.length });
      return json({ ok: true, results });
    }

    // Per-freezone government costs (investor visa, establishment card, …)
    if (route === '/admin/pricing/visa-costs' && method === 'GET') {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const r = await sbGet('freezone_pricing', 'select=*&order=freezone.asc&limit=200');
      const byZone = {};
      (r.data || []).forEach((row) => { byZone[row.freezone] = row; });
      return json({
        costs: FREEZONES.map((z) => byZone[z] || {
          freezone: z, investor_visa_cost: 0, employee_visa_cost: 0, visa_later_cost: 0,
          establishment_card_cost: 0, medical_emirates_id_cost: 0, renewal_cost: 0,
          is_active: true, notes: 'not configured yet',
        }),
      });
    }

    if (route === '/admin/pricing/visa-costs' && method === 'PATCH') {
      const auth = await requireRole(request, 'founder');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const { updates } = await request.json();
      const FIELDS = ['investor_visa_cost', 'employee_visa_cost', 'visa_later_cost',
        'establishment_card_cost', 'medical_emirates_id_cost', 'renewal_cost'];
      const results = [];
      for (const u of updates || []) {
        if (!u?.freezone) continue;
        const payload = { notes: 'edited in Admin → Pricing', updated_at: new Date().toISOString() };
        FIELDS.forEach((f) => { if (u[f] !== undefined && u[f] !== '') payload[f] = Number(u[f]); });
        const existing = await sbGet('freezone_pricing', `select=id&freezone=eq.${encodeURIComponent(u.freezone)}&limit=1`);
        if (existing.data && existing.data.length) {
          await sbPatch('freezone_pricing', `id=eq.${existing.data[0].id}`, payload);
          results.push({ zone: u.freezone, action: 'updated' });
        } else {
          await sbPost('freezone_pricing', { freezone: u.freezone, is_active: true, ...payload });
          results.push({ zone: u.freezone, action: 'created' });
        }
      }
      await auditLog(auth.session, 'pricing.visa_costs_update', { count: results.length });
      return json({ ok: true, results });
    }

    if (route.startsWith('/admin/freezone/') && method === 'GET') {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const zone = decodeURIComponent(route.split('/').pop());
      const pkgs = await sbGet('freezone_packages', `select=*&freezone=eq.${encodeURIComponent(zone)}&order=base_price.asc`);
      return json({ freezone: zone, packages: pkgs.data || [] });
    }

    if (route.startsWith('/admin/freezone/') && method === 'PUT') {
      const auth = await requireRole(request, 'founder');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const zone = decodeURIComponent(route.split('/').pop());
      const { packages } = await request.json();
      const results = [];
      for (const p of packages || []) {
        const payload = {
          freezone: zone,
          package_name: p.package_name || p.label || 'Package',
          package_type: p.package_type || 'license',
          duration_years: Number(p.duration_years || 1),
          visa_count: Number(p.visa_count || 0),
          shareholder_count: Number(p.shareholder_count || 1),
          base_price: Number(p.base_price || 0),
          discount_price: p.discount_price != null ? Number(p.discount_price) : null,
          promotion_price: p.promotion_price != null ? Number(p.promotion_price) : null,
          currency: p.currency || 'AED',
          notes: p.notes || '',
          is_active: p.is_active !== false,
        };
        if (p.id) {
          await sbPatch('freezone_packages', `id=eq.${p.id}`, payload);
          results.push({ id: p.id, action: 'updated' });
        } else {
          const r = await sbPost('freezone_packages', payload);
          results.push({ id: Array.isArray(r.data) ? r.data[0]?.id : null, action: 'created' });
        }
      }
      await auditLog(auth.session, 'freezone.save', { zone, count: results.length });
      return json({ ok: true, results });
    }

    if (route.startsWith('/admin/packages/') && method === 'DELETE') {
      const auth = await requireRole(request, 'founder');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const id = route.split('/').pop();
      await sbPatch('freezone_packages', `id=eq.${id}`, { is_active: false });
      await auditLog(auth.session, 'package.soft_delete', { id });
      return json({ ok: true });
    }

    // ============ COUPONS ============
    if (route === '/admin/coupons' && method === 'GET') {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const r = await sbGet('coupons', 'select=*&order=created_at.desc');
      return json({ coupons: r.data || [] });
    }

    if (route === '/admin/coupons' && method === 'POST') {
      const auth = await requireRole(request, 'founder', 'manager');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const body = await request.json();
      const r = await sbPost('coupons', body);
      if (!r.ok) return json({ error: r.data }, r.status);
      await auditLog(auth.session, 'coupon.create', body);
      return json({ ok: true, coupon: Array.isArray(r.data) ? r.data[0] : r.data });
    }

    if (route.startsWith('/admin/coupons/') && method === 'PATCH') {
      const auth = await requireRole(request, 'founder', 'manager');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const code = decodeURIComponent(route.split('/').pop());
      const body = await request.json();
      const r = await sbPatch('coupons', `code=eq.${code}`, body);
      if (!r.ok) return json({ error: r.data }, r.status);
      await auditLog(auth.session, 'coupon.update', { code, ...body });
      return json({ ok: true });
    }

    if (route.startsWith('/admin/coupons/') && method === 'DELETE') {
      const auth = await requireRole(request, 'founder', 'manager');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const code = decodeURIComponent(route.split('/').pop());
      await sbPatch('coupons', `code=eq.${code}`, { is_active: false });
      await auditLog(auth.session, 'coupon.deactivate', { code });
      return json({ ok: true });
    }

    // ============ FOUNDERS CLUB ============
    if (route === '/admin/founders-club' && method === 'GET') {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);

      const [r, tiersR, profilesR] = await Promise.all([
        sbGet('founder_club_memberships', 'select=*&order=created_at.desc&limit=2000'),
        sbGet('founder_club_tiers', 'select=*&order=sort_order.asc'),
        sbGet('profiles', 'select=id,email,full_name&limit=2000'),
      ]);

      const tiersById = {};
      (tiersR.data || []).forEach(t => { tiersById[t.id] = t; });
      const profilesById = {};
      (profilesR.data || []).forEach(p => { profilesById[p.id] = p; });

      const pioneer = (tiersR.data || []).find(t => t.slug === 'pioneer');
      const annual = (tiersR.data || []).find(t => t.slug === 'annual');

      const members = (r.data || []).map(m => {
        const tier = tiersById[m.tier_id];
        const profile = m.user_id ? profilesById[m.user_id] : null;
        // Decode notes JSON for external members (stored when added via admin form)
        let meta = {};
        try { if (m.notes && m.notes.startsWith('{')) meta = JSON.parse(m.notes); } catch {}
        return {
          id: m.id,
          member_number: m.member_number,
          full_name: profile?.full_name || meta.full_name || '(no name)',
          email: profile?.email || meta.email || '',
          phone: meta.phone || '',
          tier_slug: tier?.slug || 'pioneer',
          tier_name: tier?.name || 'Pioneer Member',
          tier_price: tier?.price || 0,
          status: m.status,
          member_since: m.member_since,
          expires_at: m.expires_at,
          total_saved_aed: m.total_saved_aed,
          notes_raw: m.notes,
          created_at: m.created_at,
          is_active: m.status === 'active',
        };
      });

      const free_used = members.filter(m => m.tier_slug === 'pioneer').length;
      const paid_used = members.filter(m => m.tier_slug !== 'pioneer').length;

      return json({
        members,
        tiers: tiersR.data || [],
        free_used,
        free_limit: pioneer?.launch_slots_total || 500,
        paid_used,
        paid_limit: annual?.launch_slots_total || 500,
      });
    }

    if (route === '/admin/founders-club' && method === 'POST') {
      const auth = await requireRole(request, 'founder', 'manager');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const body = await request.json();
      const { full_name, email, phone, tier, notes } = body || {};
      if (!email && !full_name) return json({ error: 'email or full_name required' }, 400);

      // 1. Resolve tier_id from slug (accept 'free'/'paid' as aliases for 'pioneer'/'annual')
      const tierSlug = tier === 'paid' ? 'annual' : (tier === 'free' ? 'pioneer' : (tier || 'pioneer'));
      const tierR = await sbGet('founder_club_tiers', `select=id&slug=eq.${encodeURIComponent(tierSlug)}&limit=1`);
      const tier_id = tierR.data?.[0]?.id;
      if (!tier_id) return json({ error: `tier '${tierSlug}' not found` }, 400);

      // 2. Look up existing staff profile by email (only for already-known staff users)
      let user_id = null;
      if (email) {
        const existing = await sbGet('profiles', `select=id&email=eq.${encodeURIComponent(email)}&limit=1`);
        if (existing.data?.length) user_id = existing.data[0].id;
      }

      // 3. Pack external member contact details into notes JSON (since profiles role enum forbids 'customer')
      const meta = { full_name, email, phone, manual_notes: notes || '', added_by: auth.session.email, added_at: new Date().toISOString() };
      const insertR = await sbPost('founder_club_memberships', {
        user_id,
        tier_id,
        status: 'active',
        notes: JSON.stringify(meta),
        member_since: new Date().toISOString(),
      });
      if (!insertR.ok) return json({ error: 'failed to create membership', detail: insertR.data }, 500);

      await auditLog(auth.session, 'founders_club.create', { tier: tierSlug, email });
      return json({ ok: true, member: Array.isArray(insertR.data) ? insertR.data[0] : insertR.data });
    }

    if (route.startsWith('/admin/founders-club/') && method === 'PATCH') {
      const auth = await requireRole(request, 'founder', 'manager');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const id = route.split('/').pop();
      const body = await request.json();
      const patch = {};
      if (body.is_active !== undefined) patch.status = body.is_active ? 'active' : 'inactive';
      if (body.status) patch.status = body.status;
      if (body.notes !== undefined) patch.notes = body.notes;
      if (body.expires_at !== undefined) patch.expires_at = body.expires_at;
      const r = await sbPatch('founder_club_memberships', `id=eq.${id}`, patch);
      if (!r.ok) return json({ error: r.data }, r.status);
      await auditLog(auth.session, 'founders_club.update', { id, ...patch });
      return json({ ok: true });
    }

    // ============ STAFF & ACCESS ============
    if (route === '/admin/staff' && method === 'GET') {
      const auth = await requireRole(request, 'founder', 'manager');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      await seedDefaultUsers();
      const c = await col('admin_users');
      const filter = auth.session.role === 'manager' ? { $or: [{ id: auth.session.sub }, { assigned_manager: auth.session.sub }] } : {};
      const users = await c.find(filter, { projection: { password_hash: 0, pin_hash: 0 } }).toArray();
      return json({ staff: users });
    }

    if (route === '/admin/staff' && method === 'POST') {
      const auth = await requireRole(request, 'founder', 'manager');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const body = await request.json();
      const { full_name, username, email, role, pin, password, assigned_manager } = body || {};
      if (!role) return json({ error: 'role required' }, 400);
      if (auth.session.role === 'manager' && !['staff', 'reviewer'].includes(role)) {
        return json({ error: 'Manager can only create staff or reviewer' }, 403);
      }
      if (auth.session.role !== 'founder' && role === 'founder') {
        return json({ error: 'Only founder can create founders' }, 403);
      }
      const c = await col('admin_users');
      const existing = await c.findOne({ $or: [{ email: (email || '').toLowerCase() }, { username: (username || '').toLowerCase() }] });
      if (existing) return json({ error: 'Email or username already exists' }, 400);
      const newUser = {
        id: uuid(),
        role,
        email: (email || '').toLowerCase().trim(),
        username: (username || (email || '').split('@')[0]).toLowerCase().trim(),
        full_name: full_name || username,
        password_hash: ['founder', 'manager'].includes(role) && password ? await bcrypt.hash(password, 10) : null,
        pin_hash: ['staff', 'reviewer'].includes(role) && pin ? await bcrypt.hash(String(pin), 10) : null,
        is_active: true,
        assigned_manager: auth.session.role === 'manager' ? auth.session.sub : (assigned_manager || null),
        created_at: new Date(),
        created_by: auth.session.sub,
      };
      await c.insertOne(newUser);
      await auditLog(auth.session, 'staff.create', { id: newUser.id, role, username: newUser.username });

      // Send welcome email with credentials via Resend
      let emailResult = { ok: false, skipped: true };
      if (newUser.email) {
        const loginUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://smartsetupuae.ae'}/admin/login`;
        const tpl = staffWelcomeEmail({
          full_name: newUser.full_name,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
          pin: pin || null,
          password: password || null,
          loginUrl,
        });
        emailResult = await sendEmail({ to: newUser.email, ...tpl });
      }

      return json({
        ok: true,
        email_sent: emailResult.ok,
        email_skipped: !!emailResult.skipped,
        user: { ...newUser, password_hash: undefined, pin_hash: undefined, plain_pin: pin || null, plain_password: password || null },
      });
    }

    if (route.startsWith('/admin/staff/') && route.endsWith('/reset-pin') && method === 'POST') {
      const auth = await requireRole(request, 'founder', 'manager');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const id = route.split('/')[3];
      const { pin } = await request.json();
      const c = await col('admin_users');
      const target = await c.findOne({ id });
      const hash = await bcrypt.hash(String(pin), 10);
      await c.updateOne({ id }, { $set: { pin_hash: hash, pin_updated_at: new Date() } });
      await auditLog(auth.session, 'staff.reset_pin', { id });

      // Email the new PIN if user has email
      let emailSent = false;
      if (target?.email) {
        const loginUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://smartsetupuae.ae'}/admin/login`;
        const tpl = pinResetEmail({ full_name: target.full_name, username: target.username, pin, loginUrl });
        const r = await sendEmail({ to: target.email, ...tpl });
        emailSent = r.ok;
      }
      return json({ ok: true, email_sent: emailSent });
    }

    if (route.startsWith('/admin/staff/') && method === 'PATCH') {
      const auth = await requireRole(request, 'founder', 'manager');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const id = route.split('/')[3];
      const body = await request.json();
      const c = await col('admin_users');
      const patch = {};
      if (body.is_active !== undefined) patch.is_active = !!body.is_active;
      if (body.full_name) patch.full_name = body.full_name;
      if (body.role) {
        if (auth.session.role === 'manager' && !['staff', 'reviewer'].includes(body.role)) return json({ error: 'forbidden role change' }, 403);
        patch.role = body.role;
      }
      if (body.assigned_manager !== undefined) patch.assigned_manager = body.assigned_manager;
      await c.updateOne({ id }, { $set: patch });
      await auditLog(auth.session, 'staff.update', { id, ...patch });
      return json({ ok: true });
    }

    if (route.startsWith('/admin/staff/') && method === 'DELETE') {
      const auth = await requireRole(request, 'founder');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const id = route.split('/')[3];
      const c = await col('admin_users');
      await c.deleteOne({ id });
      await auditLog(auth.session, 'staff.delete', { id });
      return json({ ok: true });
    }

    // ============ SETTINGS ============
    if (route === '/admin/settings' && method === 'GET') {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const c = await col('site_config');
      const cfg = (await c.findOne({ _id: 'main' })) || {};
      delete cfg._id;
      return json({
        whatsapp_number: cfg.whatsapp_number || '+971563035503',
        support_email: cfg.support_email || 'admin@smartsetupuae.ae',
        early_bird_discount: cfg.early_bird_discount ?? 5,
        prebooking_amount: cfg.prebooking_amount ?? 999,
        founders_free_limit: cfg.founders_free_limit ?? 500,
        founders_paid_limit: cfg.founders_paid_limit ?? 500,
      });
    }

    if (route === '/admin/settings' && method === 'PUT') {
      const auth = await requireRole(request, 'founder');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const body = await request.json();
      const c = await col('site_config');
      await c.updateOne({ _id: 'main' }, { $set: { ...body, updated_at: new Date() } }, { upsert: true });
      await auditLog(auth.session, 'settings.update', body);
      return json({ ok: true });
    }

    // ============ ROOT ============
    if (route === '/admin/seed' && method === 'POST') {
      // SECURITY: seed endpoint must be founder-only — never expose publicly
      const auth = await requireRole(request, 'founder');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const result = await seedDefaultUsers();
      return json(result);
    }

    // ============ ARIA AI (PUBLIC - no auth) ============
    if (route === '/aria/chat' && method === 'POST') {
      const { message, history, sessionId } = await request.json();
      if (!message) return json({ error: 'message required' }, 400);
      const result = await chatWithAria({ history: history || [], message, sessionId: sessionId || 'anon' });
      if (!result.ok) return json({ error: result.error }, 500);

      // Save lead capture to Mongo aria_chats for admin visibility
      try {
        const c = await col('aria_chats');
        await c.insertOne({
          id: uuid(),
          session_id: sessionId || 'anon',
          message,
          reply: result.text,
          at: new Date(),
        });
      } catch (e) { console.error('[aria] log fail', e); }

      return json({ ok: true, reply: result.text, sessionId: result.sessionId });
    }

    // ============ LEGAL PAGES ============
    if (route === '/admin/legal' && method === 'GET') {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const c = await col('legal_pages');
      const docs = await c.find({}).toArray();
      const pages = {};
      docs.forEach(d => { pages[d.slug] = d.content; });
      return json({ pages });
    }

    if (route.startsWith('/admin/legal/') && method === 'PUT') {
      const auth = await requireRole(request, 'founder');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const slug = route.split('/').pop();
      const { content } = await request.json();
      const c = await col('legal_pages');
      await c.updateOne({ slug }, { $set: { slug, content, updated_at: new Date(), updated_by: auth.session.email } }, { upsert: true });
      await auditLog(auth.session, 'legal.update', { slug });
      return json({ ok: true });
    }

    // ============ SEO META ============
    if (route === '/admin/seo' && method === 'GET') {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const c = await col('seo_meta');
      const docs = await c.find({}).toArray();
      const pages = {};
      docs.forEach(d => { const { _id, slug, ...rest } = d; pages[slug] = rest; });
      return json({ pages });
    }

    if (route.startsWith('/admin/seo/sitemap') && method === 'POST') {
      const auth = await requireRole(request, 'founder');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const c = await col('seo_meta');
      const pages = await c.find({}).toArray();
      // Save sitemap to mongo (real-world: write to /public/sitemap.xml)
      const sitemap = await col('site_artifacts');
      await sitemap.updateOne(
        { _id: 'sitemap' },
        { $set: { generated_at: new Date(), url_count: pages.length, urls: pages.map(p => p.slug) } },
        { upsert: true }
      );
      return json({ ok: true, urls: pages.length });
    }

    if (route.startsWith('/admin/seo/') && method === 'PUT') {
      const auth = await requireRole(request, 'founder');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const slug = route.split('/').pop();
      const body = await request.json();
      const c = await col('seo_meta');
      await c.updateOne({ slug }, { $set: { slug, ...body, updated_at: new Date() } }, { upsert: true });
      await auditLog(auth.session, 'seo.update', { slug });
      return json({ ok: true });
    }


    // ============ SUPPORT TICKETS ============

    if (route === '/admin/tickets' && method === 'GET') {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const { searchParams } = new URL(request.url);
      const filters = {
        status:     searchParams.get('status')     || undefined,
        priority:   searchParams.get('priority')   || undefined,
        category:   searchParams.get('category')   || undefined,
        assignedTo: searchParams.get('assignedTo') || undefined,
        search:     searchParams.get('search')     || undefined,
        page:       Number(searchParams.get('page') || 1),
        limit:      Number(searchParams.get('limit') || 25),
      };
      const result = await listTickets(filters);
      return json(result);
    }

    if (route === '/admin/tickets/stats' && method === 'GET') {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const stats = await getTicketStats();
      return json(stats);
    }

    // Aria auto-reply gate config (shared Mongo doc with the FastAPI backend)
    if (route === '/admin/ai-support/config' && (method === 'GET' || method === 'PATCH')) {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const cfgCol = await col('ai_support_config');
      const DEFAULTS = {
        mode: 'SUGGEST_ONLY',
        confidence_threshold: 0.8,
        allowed_categories: ['general'],
        blocked_categories: ['payment', 'visa', 'compliance', 'foundersclub', 'account'],
        allowed_priorities: ['low', 'medium'],
        auto_resolve: true,
      };
      if (method === 'PATCH') {
        const body = await request.json();
        const ALLOWED_KEYS = ['mode', 'confidence_threshold', 'allowed_categories', 'blocked_categories', 'allowed_priorities', 'auto_resolve'];
        const patch = {};
        for (const k of ALLOWED_KEYS) if (body[k] !== undefined) patch[k] = body[k];
        if (patch.mode && !['DISABLED', 'SUGGEST_ONLY', 'AUTO_REPLY'].includes(patch.mode)) {
          return json({ error: 'Invalid mode' }, 400);
        }
        patch.updated_at = new Date().toISOString();
        await cfgCol.updateOne({ _id: 'singleton' }, { $set: patch }, { upsert: true });
        await auditLog(auth.session, 'ai_support.config.update', patch);
      }
      const doc = await cfgCol.findOne({ _id: 'singleton' });
      return json({ ...DEFAULTS, ...(doc || {}) });
    }

    if (route === '/admin/support-analytics' && method === 'GET') {      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const days = Number(new URL(request.url).searchParams.get('days') || 30);
      const data = await getSupportAnalytics(days);
      return json(data);
    }

    // Public ticket creation (website contact form) — no auth required
    // Rate-limit protection is handled at the Next.js headers level
    if (route === '/tickets/create' && method === 'POST') {
      const body = await request.json();
      // Basic spam guard: require name + email + message
      if (!body?.name || !body?.email || !body?.message) {
        return json({ error: 'name, email and message are required' }, 400);
      }
      try {
        const ticket = await createTicket({ ...body, source: 'form' });
        return json({ ok: true, ticketId: ticket.ticketId }, 201);
      } catch (e) {
        return json({ error: e.message }, 400);
      }
    }

    // Admin ticket creation (manual, from dashboard) — requires auth
    if (route === '/admin/tickets/create' && method === 'POST') {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const body = await request.json();
      try {
        const ticket = await createTicket({ ...body, source: 'manual' });
        return json({ ok: true, ticket }, 201);
      } catch (e) {
        return json({ error: e.message }, 400);
      }
    }

    if (path[0] === 'admin' && path[1] === 'tickets' && path[2] && path[2] !== 'create' && path[2] !== 'stats') {
      const auth = await requireRole(request);
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const ticketId = path[2];
      const sub = path[3];

      if (!sub && method === 'GET') {
        const ticket = await getTicket(ticketId);
        if (!ticket) return json({ error: 'Ticket not found' }, 404);
        return json({ ticket });
      }

      if (sub === 'reply' && method === 'POST') {
        const body = await request.json();
        const { message, attachments, sender = 'admin' } = body;
        try {
          const updated = await replyToTicket({
            ticketId, sender, message, attachments,
            adminName: auth.session?.name,
            userId: auth.session?.sub,
          });
          return json({ ok: true, ticket: updated });
        } catch (e) {
          return json({ error: e.message }, 400);
        }
      }

      if (sub === 'status' && method === 'PATCH') {
        const body = await request.json();
        const { status, priority } = body;
        if (priority) {
          const tickets = await col('tickets');
          await tickets.updateOne({ ticketId }, { $set: { priority, updatedAt: new Date() } });
          return json({ ok: true, priority });
        }
        try {
          const result = await updateTicketStatus({ ticketId, status, userId: auth.session?.sub });
          return json(result);
        } catch (e) {
          return json({ error: e.message }, 400);
        }
      }

      if (sub === 'assign' && method === 'PATCH') {
        const { assignedTo } = await request.json();
        try {
          const result = await assignTicket({ ticketId, assignedTo });
          return json(result);
        } catch (e) {
          return json({ error: e.message }, 400);
        }
      }

      if (sub === 'notes' && method === 'POST') {
        const { note } = await request.json();
        try {
          const result = await addInternalNote({
            ticketId, note,
            adminId: auth.session?.sub,
            adminName: auth.session?.name,
          });
          return json(result);
        } catch (e) {
          return json({ error: e.message }, 400);
        }
      }

      if (sub === 'attachments' && path[4] === 'sign-upload' && method === 'POST') {
        const { filename, content_type, size } = await request.json();
        const ct = String(content_type || '').toLowerCase().split(';')[0].trim();
        const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
        const MAX = 10 * 1024 * 1024;
        if (!ALLOWED.includes(ct)) return json({ error: `File type '${ct}' not allowed.` }, 400);
        if (Number(size) > MAX) return json({ error: 'File too large. Max 10 MB.' }, 400);
        const bucket = process.env.SUPPORT_ATTACHMENTS_BUCKET || 'support-attachments';
        const t = await getTicket(ticketId);
        const safe = String(filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
        const objPath = `tickets/${t?._id || ticketId}/${uuid().slice(0, 8)}-${safe}`;
        const r = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/upload/sign/${bucket}/${objPath}`, {
          method: 'POST',
          headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
        });
        const d = r.ok ? await r.json() : {};
        return json({
          path: objPath,
          content_type,
          upload_url: `${process.env.SUPABASE_URL}/storage/v1${d.url || `/object/upload/sign/${bucket}/${objPath}`}`,
        }, r.ok ? 200 : r.status);
      }

      if (sub === 'attachments' && path[4] === 'sign-download' && method === 'POST') {
        const { path: objPath } = await request.json();
        const bucket = process.env.SUPPORT_ATTACHMENTS_BUCKET || 'support-attachments';
        const r = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/sign/${bucket}/${objPath}`, {
          method: 'POST',
          headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ expiresIn: 3600 }),
        });
        const d = r.ok ? await r.json() : {};
        return json({ signed_url: `${process.env.SUPABASE_URL}/storage/v1${d.signedURL || ''}` }, r.ok ? 200 : r.status);
      }
    }

    // ============ EMAIL LOGS ============

    if (route === '/admin/email-logs' && method === 'GET') {
      const auth = await requireRole(request, 'founder', 'manager');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const { searchParams } = new URL(request.url);
      const page   = Number(searchParams.get('page') || 1);
      const limit  = Number(searchParams.get('limit') || 50);
      const type   = searchParams.get('type') || undefined;
      const status = searchParams.get('status') || undefined;
      const query  = {};
      if (type)   query.type   = type;
      if (status) query.status = status;
      const logs = await col('email_logs');
      const [items, total] = await Promise.all([
        logs.find(query).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
        logs.countDocuments(query),
      ]);
      return json({ logs: items, total, page, pages: Math.ceil(total / limit) });
    }

    if (route === '/admin/email/send' && method === 'POST') {
      const auth = await requireRole(request, 'founder', 'manager');
      if (!auth.ok) return json({ error: auth.error }, auth.status);
      const { type, to, subject, html } = await request.json();
      if (!type || !to || !subject || !html) {
        return json({ error: 'type, to, subject, html are required' }, 400);
      }
      try {
        const result = await sendRoutedEmail({ type, to, subject, html, userId: auth.session?.sub });
        return json(result);
      } catch (e) {
        return json({ error: e.message }, 400);
      }
    }

    return json({ error: `Route ${method} ${route} not found` }, 404);
  } catch (e) {
    console.error('[api] error', route, method, e);
    return json({ error: String(e?.message || e) }, 500);
  }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
