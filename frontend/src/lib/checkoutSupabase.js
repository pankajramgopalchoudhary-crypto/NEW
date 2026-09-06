import { postgrestValue, supabaseRest } from './supabaseRest';

const PREBOOKING_AMOUNT_AED = 999;
const VISA_PRICE_AED = 5912;   // fallback only — live values come from freezone_pricing
const DEFAULT_SERVICE_FEE_AED = 1500;

// freezone slug -> government cost row (investor visa, establishment card, …).
// Populated by loadCheckoutPricing() so pricing is never hardcoded per zone.
let visaPricingByZone = {};

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function money(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value, fallback = true) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return fallback;
}

function cleanRow(row = {}) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [String(key).replace(/^\uFEFF/, ''), value]));
}

function firstAvailable(input, keys, fallback = null) {
  const row = cleanRow(input);
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') return row[key];
  }
  return fallback;
}

function normalizePackage(input) {
  const row = cleanRow(input);
  const freezone = firstAvailable(row, ['freezone', 'freezone_name', 'jurisdiction', 'authority'], 'Free Zone');
  const packageName = firstAvailable(row, ['package_name', 'name', 'title', 'category'], 'Business Setup Package');
  const price = money(firstAvailable(row, ['display_price', 'offer_price', 'package_price', 'base_price', 'original_price', 'price'], 0));
  const serviceFee = money(firstAvailable(row, ['service_fee', 'svc', 'advisory_fee'], 0), 0);
  const id = firstAvailable(row, ['id', 'package_id'], `${slugify(freezone)}-${slugify(packageName)}-${price}`);

  return {
    id: String(id),
    selection_id: String(id),
    package_id: firstAvailable(row, ['package_id', 'id'], null),
    slug: firstAvailable(row, ['slug', 'freezone_slug'], slugify(freezone)),
    name: freezone,
    package_name: packageName,
    category: firstAvailable(row, ['category', 'package_type'], null),
    duration: firstAvailable(row, ['duration', 'validity'], '1 Year'),
    workspace: firstAvailable(row, ['workspace', 'office_type', 'facility'], 'Subject to authority package'),
    includes_visa: firstAvailable(row, ['includes_visa', 'visa_count', 'visas'], null),
    visa_quota: money(firstAvailable(row, ['visa_count', 'visas', 'max_visas'], firstAvailable(row, ['includes_visa'], 0)), 0),
    gov: price,
    svc: serviceFee,
    currency: firstAvailable(row, ['currency'], 'AED'),
    is_active: bool(firstAvailable(row, ['is_active', 'active'], true), true),
    source: 'supabase',
    raw: row,
  };
}

function normalizeAddon(input) {
  const row = cleanRow(input);
  const name = firstAvailable(row, ['addon_name', 'name', 'label', 'title'], 'Service Add-on');
  const id = firstAvailable(row, ['id', 'addon_id'], slugify(name));
  return {
    id: String(id),
    addon_id: firstAvailable(row, ['addon_id', 'id'], null),
    label: name,
    price: money(firstAvailable(row, ['price', 'display_price', 'amount'], 0)),
    unit: firstAvailable(row, ['unit'], 'one-time'),
    addon_category: firstAvailable(row, ['addon_category', 'category'], null),
    notes: firstAvailable(row, ['notes', 'description'], ''),
    freezone: firstAvailable(row, ['freezone', 'freezone_name'], null),
    is_active: bool(firstAvailable(row, ['is_active', 'active'], true), true),
    source: 'supabase',
    raw: row,
  };
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function selectFirstWorkingTable(candidates) {
  let lastError = null;
  for (const { table, query, normalize } of candidates) {
    try {
      const rows = await supabaseRest.select(table, query);
      return { table, rows: (rows || []).map(normalize).filter((row) => row.is_active !== false) };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Supabase pricing table not available');
}

export async function loadCheckoutPricing() {
  const [packagesResult, addonsResult, visaPricingRows] = await Promise.all([
    selectFirstWorkingTable([
      { table: 'checkout_package_options', query: '?select=*', normalize: normalizePackage },
      { table: 'freezone_packages', query: '?select=*&is_active=eq.true', normalize: normalizePackage },
      { table: 'freezone_packages', query: '?select=*', normalize: normalizePackage },
    ]),
    selectFirstWorkingTable([
      { table: 'checkout_addon_options', query: '?select=*', normalize: normalizeAddon },
      { table: 'service_addons', query: '?select=*&is_active=eq.true', normalize: normalizeAddon },
      { table: 'service_addons', query: '?select=*', normalize: normalizeAddon },
      { table: 'package_addons', query: '?select=*&is_active=eq.true', normalize: normalizeAddon },
      { table: 'package_addons', query: '?select=*', normalize: normalizeAddon },
    ]).catch(() => ({ table: null, rows: [] })),
    supabaseRest.select('freezone_pricing', '?select=*').catch(() => []),
  ]);

  visaPricingByZone = Object.fromEntries(
    (visaPricingRows || [])
      .filter((row) => row.is_active !== false)
      .map((row) => [slugify(row.freezone || ''), row]),
  );

  const zones = uniqueBy(packagesResult.rows, (item) => item.package_id || item.selection_id)
    // Hide renewal packages — checkout is for NEW registrations
    .filter((item) => {
      const name = String(item.package_name || item.name || '').toLowerCase();
      if (/(renewal|renew|all inclusive installment)/.test(name)) return false;
      const src = String(item.source || '').toLowerCase();
      if (src === 'renewal') return false;
      return true;
    });
  if (!zones.length) throw new Error('No live Supabase checkout packages returned. Check checkout_package_options/freezone_packages policies and data.');

  return {
    zones,
    addons: uniqueBy(addonsResult.rows, (item) => item.addon_id || item.id),
    packageSourceTable: packagesResult.table,
    addonSourceTable: addonsResult.table,
  };
}

function buildOrderReference() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `SSU-${date}-${suffix}`;
}

function newUuid() {
  return (typeof window !== 'undefined' && window.crypto?.randomUUID)
    ? window.crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
}

function buildOrderPayload(draft, totalAed, user) {
  const reference = buildOrderReference();
  const contact = draft.contact || {};
  const business = draft.business || {};
  const addonsTotal = (draft.addons || []).reduce((sum, a) => sum + money(a.price, 0), 0);
  const finalTotal = money(totalAed, 0);
  const basePrice = Math.max(finalTotal - addonsTotal, 0);

  const noteParts = [
    `Ref: ${reference}`,
    business.activity ? `Activity: ${business.activity}` : null,
    (business.company_names || []).filter(Boolean).length ? `Company names: ${(business.company_names || []).filter(Boolean).join(', ')}` : null,
    draft.office_type ? `Office: ${draft.office_type}` : null,
    user?.id ? `User: ${user.id}` : null,
  ].filter(Boolean);

  return {
    id: newUuid(),
    reference,
    order_ref: reference,   // persisted column — keeps admin + dashboard refs identical
    customer_name: contact.name || null,
    customer_email: contact.email || null,
    customer_phone: contact.phone ? `${contact.phone_code || ''} ${contact.phone}`.trim() : null,
    freezone: draft.zone_name || draft.zone_slug || 'Free Zone',
    package_id: draft.package_id || null,
    package_name: draft.package_name || draft.zone_name || null,
    duration_years: money(draft.duration_years, 1),
    visa_count: money(draft.visa_count, 0),
    shareholder_count: money(business.shareholders, 1),
    base_price: basePrice,
    addons_total: addonsTotal,
    discount_total: money(draft.discount_total, 0),
    final_total: finalTotal,
    currency: 'AED',
    status: 'draft',
    notes: noteParts.join(' | ') || null,
  };
}

async function recalculateOrder(orderId) {
  return supabaseRest.rpc('recalculate_checkout_order', { p_order_id: orderId });
}

export async function createCheckoutOrder(draft, totalAed, user) {
  const orderPayload = buildOrderPayload(draft, totalAed, user);
  const { reference, ...orderRow } = orderPayload;
  await supabaseRest.insert('checkout_orders', [orderRow], null, 'return=minimal');
  const orderId = orderRow.id;

  for (const addon of draft.addons || []) {
    await supabaseRest.insert('checkout_order_addons', [{
      order_id: orderId,
      addon_name: addon.label || addon.addon_name || 'Add-on',
      addon_category: addon.addon_category || null,
      price: money(addon.price, 0),
      currency: 'AED',
    }], null, 'return=minimal');
  }

  try {
    await recalculateOrder(orderId);
  } catch (error) {
    console.warn('[checkout] Order saved but recalculation skipped:', error.message);
  }

  return { id: orderId, reference, ...orderRow };
}

export async function markBankTransferSubmitted(order, bankProof) {
  const query = `?id=eq.${postgrestValue(order.id)}`;
  const noteSuffix = [
    'Bank transfer proof submitted',
    bankProof.payment_choice === 'full' ? 'FULL PAYMENT' : 'RESERVE SLOT (AED 999)',
    bankProof.amount_aed ? `Amount: AED ${Number(bankProof.amount_aed).toLocaleString()}` : null,
    bankProof.reference ? `Ref: ${bankProof.reference}` : null,
    bankProof.payer_name ? `Payer: ${bankProof.payer_name}` : null,
    bankProof.file_name ? `File: ${bankProof.file_name}` : null,
  ].filter(Boolean).join(' | ');

  return supabaseRest.update('checkout_orders', {
    status: 'payment_review',
    notes: noteSuffix,
  }, query, null);
}

export function getPrebookingAmount() {
  return PREBOOKING_AMOUNT_AED;
}

export async function listUserOrders(email) {
  if (!email) return [];
  try {
    const q = `?select=*&customer_email=eq.${encodeURIComponent(email.toLowerCase())}&order=created_at.desc&limit=20`;
    const rows = await supabaseRest.select('checkout_orders', q);
    return rows || [];
  } catch (e) {
    console.warn('[dashboard] could not load orders:', e?.message);
    return [];
  }
}

export function getVisaPrice(freezone, kind = 'investor') {
  const row = visaPricingByZone[slugify(freezone || '')];
  const price = kind === 'employee' ? row?.employee_visa_cost : row?.investor_visa_cost;
  return money(price, 0) > 0 ? money(price) : VISA_PRICE_AED;
}

export function getZoneGovCosts(freezone) {
  return visaPricingByZone[slugify(freezone || '')] || null;
}

export function getDefaultServiceFee() {
  return DEFAULT_SERVICE_FEE_AED;
}
