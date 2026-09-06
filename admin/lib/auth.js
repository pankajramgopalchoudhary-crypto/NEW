import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { col } from './mongo';
import { v4 as uuid } from 'uuid';

const SECRET = process.env.ADMIN_JWT_SECRET;
if (!SECRET) throw new Error('ADMIN_JWT_SECRET env var is required');
const SESSION_HOURS = 8;

const ROLE_PERMS = {
  founder: ['*'],
  manager: ['dashboard', 'analytics', 'leads', 'clients', 'documents', 'invoices', 'payments', 'coupons', 'founders-club', 'staff:own'],
  staff: ['dashboard', 'leads', 'clients', 'documents:read', 'invoices', 'payments:read'],
  reviewer: ['documents'],
};

export function rolePerms(role) {
  return ROLE_PERMS[role] || [];
}

export function canAccess(role, perm) {
  const perms = rolePerms(role);
  if (perms.includes('*')) return true;
  if (perms.includes(perm)) return true;
  if (perms.includes(perm + ':read') || perms.includes(perm + ':own')) return true;
  return false;
}

export async function seedDefaultUsers() {
  const c = await col('admin_users');
  const count = await c.countDocuments({});
  if (count > 0) return { seeded: false, count };

  const founderHash = await bcrypt.hash(process.env.FOUNDER_PASSWORD, 10);
  const managerHash = await bcrypt.hash('Manager@2026', 10);
  const staffPin = await bcrypt.hash('1234', 10);
  const reviewerPin = await bcrypt.hash('5678', 10);

  await c.insertMany([
    {
      id: uuid(),
      role: 'founder',
      email: process.env.FOUNDER_EMAIL || 'admin@smartsetupuae.ae',
      username: 'founder',
      full_name: 'Pankaj Choudhary',
      password_hash: founderHash,
      pin_hash: null,
      is_active: true,
      assigned_manager: null,
      created_at: new Date(),
    },
    {
      id: uuid(),
      role: 'manager',
      email: 'manager@smartsetupuae.ae',
      username: 'manager',
      full_name: 'Default Manager',
      password_hash: managerHash,
      pin_hash: null,
      is_active: true,
      assigned_manager: null,
      created_at: new Date(),
    },
    {
      id: uuid(),
      role: 'staff',
      email: 'staff@smartsetupuae.ae',
      username: 'staff01',
      full_name: 'Default Staff',
      password_hash: null,
      pin_hash: staffPin,
      is_active: true,
      assigned_manager: null,
      created_at: new Date(),
    },
    {
      id: uuid(),
      role: 'reviewer',
      email: 'reviewer@smartsetupuae.ae',
      username: 'reviewer01',
      full_name: 'Default Reviewer',
      password_hash: null,
      pin_hash: reviewerPin,
      is_active: true,
      assigned_manager: null,
      created_at: new Date(),
    },
  ]);
  return { seeded: true, count: 4 };
}

export async function loginWithPassword(email, password, expectRole) {
  await seedDefaultUsers();
  const c = await col('admin_users');
  const user = await c.findOne({ email: email.toLowerCase().trim() });
  if (!user) return { ok: false, error: 'No such user' };
  if (!user.is_active) return { ok: false, error: 'Account locked. Contact founder.' };
  if (expectRole && user.role !== expectRole) return { ok: false, error: `This account is not a ${expectRole}` };
  if (!user.password_hash) return { ok: false, error: 'This account uses PIN login' };
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return { ok: false, error: 'Wrong password' };
  return { ok: true, user };
}

export async function loginWithPin(username, pin, expectRole) {
  await seedDefaultUsers();
  const c = await col('admin_users');
  const user = await c.findOne({ username: username.toLowerCase().trim() });
  if (!user) return { ok: false, error: 'No such user' };
  if (!user.is_active) return { ok: false, error: 'Account locked. Contact founder.' };
  if (expectRole && user.role !== expectRole) return { ok: false, error: `This account is not a ${expectRole}` };
  if (!user.pin_hash) return { ok: false, error: 'This account uses password login' };
  const ok = await bcrypt.compare(pin, user.pin_hash);
  if (!ok) return { ok: false, error: 'Wrong PIN' };
  return { ok: true, user };
}

export function issueToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    name: user.full_name,
  };
  return jwt.sign(payload, SECRET, { expiresIn: `${SESSION_HOURS}h` });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(request) {
  let token = null;
  const cookieHeader = request.headers.get('cookie') || '';
  const m = cookieHeader.match(/(?:^|;\s*)ss_admin=([^;]+)/);
  if (m) token = decodeURIComponent(m[1]);
  if (!token) {
    const auth = request.headers.get('authorization') || '';
    if (auth.toLowerCase().startsWith('bearer ')) token = auth.slice(7).trim();
  }
  if (!token) return null;
  return verifyToken(token);
}

export async function requireRole(request, ...allowedRoles) {
  const session = await getSessionFromRequest(request);
  if (!session) return { ok: false, error: 'unauthorized', status: 401 };
  if (allowedRoles.length && !allowedRoles.includes(session.role)) {
    return { ok: false, error: 'forbidden', status: 403 };
  }
  return { ok: true, session };
}

export async function auditLog(session, action, meta = {}) {
  try {
    const c = await col('audit_log');
    await c.insertOne({
      id: uuid(),
      at: new Date(),
      actor_id: session?.sub,
      actor_role: session?.role,
      actor_email: session?.email,
      action,
      meta,
    });
  } catch (e) {
    console.error('[audit_log] failed', e);
  }
}
