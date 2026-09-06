// Founder Club Services + Reminders helpers (Phase 11 / Iteration 11)
import { supabaseRest } from './supabaseRest';
import { getToken } from './authTokenStorage';

const token = getToken;
const safe = (v) => String(v || '').toLowerCase().trim();

const CATALOG = [
  { key: 'licence_renewal',  title: 'Trade Licence Renewal',   cadenceDays: 365, baseCostAED: 6500, icon: 'FileText',      desc: 'Annual renewal of your free-zone trade licence.' },
  { key: 'emirates_id',      title: 'Emirates ID Renewal',     cadenceDays: 730, baseCostAED: 370,  icon: 'BadgeCheck',    desc: 'Emirates ID renewal every 2 years (or 3 for some categories).' },
  { key: 'corp_tax',         title: 'Corporate Tax Filing',    cadenceDays: 365, baseCostAED: 1500, icon: 'Calculator',    desc: 'UAE 9% Corporate Tax annual return (filed within 9 months of year-end).' },
  { key: 'vat_filing',       title: 'VAT Filing (quarterly)',  cadenceDays: 90,  baseCostAED: 750,  icon: 'Receipt',       desc: 'Quarterly VAT return submission — required if turnover ≥ AED 375k.' },
  { key: 'municipality',     title: 'Municipality / Tasdeeq',  cadenceDays: 365, baseCostAED: 1100, icon: 'Building',      desc: 'Annual lease attestation & municipality fees.' },
  { key: 'bookkeeping',      title: 'Bookkeeping & Billing',   cadenceDays: 0,   baseCostAED: 0,    icon: 'Database',      desc: 'Coming soon — embedded billing software inside your dashboard.', comingSoon: true },
];

export const SERVICES_CATALOG = CATALOG;

export async function listReminders(email) {
  if (!email) return [];
  try {
    const q = `?select=*&user_email=eq.${encodeURIComponent(safe(email))}&order=due_date.asc&limit=100`;
    return (await supabaseRest.select('reminders', q, token())) || [];
  } catch (e) {
    console.warn('[reminders] list failed:', e?.message);
    return [];
  }
}

export async function upsertReminder(email, row) {
  return supabaseRest.upsert(
    'reminders',
    [{ user_email: safe(email), ...row, updated_at: new Date().toISOString() }],
    token()
  );
}

export async function updateNotifPrefs(email, prefs) {
  // prefs: { whatsapp: bool, email: bool, in_app: bool }
  return supabaseRest.upsert(
    'notification_preferences',
    [{ user_email: safe(email), ...prefs, updated_at: new Date().toISOString() }],
    token()
  );
}

export async function getNotifPrefs(email) {
  try {
    const q = `?select=*&user_email=eq.${encodeURIComponent(safe(email))}&limit=1`;
    const rows = await supabaseRest.select('notification_preferences', q, token());
    return rows?.[0] || { whatsapp: true, email: true, in_app: true };
  } catch {
    return { whatsapp: true, email: true, in_app: true };
  }
}

/** Compute reminder status based on due_date */
export function statusOf(due) {
  if (!due) return { label: 'No date', tone: 'bg-slate-100 text-slate-600' };
  const d = new Date(due);
  const ms = d.getTime() - Date.now();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: 'Overdue', tone: 'bg-rose-100 text-rose-800', days };
  if (days <= 14) return { label: 'Due Soon', tone: 'bg-amber-100 text-amber-800', days };
  if (days <= 60) return { label: 'Upcoming', tone: 'bg-emerald-100 text-emerald-800', days };
  return { label: 'Scheduled', tone: 'bg-slate-100 text-slate-700', days };
}
