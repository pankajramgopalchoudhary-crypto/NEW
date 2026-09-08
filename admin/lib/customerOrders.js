import { v4 as uuid } from 'uuid';
import { col } from './mongo';
import { sbGet, sbPost } from './supabase';

const MAX_ORDER_AED = 1000000;
const money = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const now = () => new Date().toISOString();
const reference = () => `SSU-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

async function publicCollection(name, filter) {
  return (await col(name)).find(filter).toArray();
}

async function priceItem(item) {
  if (item.kind === 'service') {
    const service = await (await col('service_catalog')).findOne({ slug: item.slug, is_active: true });
    if (!service) throw new Error(`Unknown or inactive service: ${item.slug}`);
    let unit = money(service.price_aed);
    let variant = null;
    if (item.service_variant) {
      variant = (service.pricing_options || []).find((option) => option.id === item.service_variant);
      if (!variant || variant.on_request) throw new Error('Selected service pricing tier is not available for online checkout');
      unit = money(variant.annual);
    }
    if (unit <= 0) throw new Error('Service has no valid price');
    const qty = Math.min(Math.max(Number(item.qty) || 1, 1), 50);
    return { kind: 'service', ref: service.slug, name: service.name, billing: service.billing || 'one-time', unit_price_aed: unit, qty, line_total_aed: Math.round(unit * qty * 100) / 100, source: 'mongo:service_catalog', service_variant: variant?.id || null };
  }
  if (item.kind === 'package') {
    const filter = item.package_id ? { _id: item.package_id } : { freezone: item.freezone, package_name: item.package_name };
    const packageRow = await (await col('package_catalog')).findOne({ ...filter, is_active: true });
    if (!packageRow) throw new Error('Unknown or inactive package');
    if (packageRow.pricing_mode === 'on_request') throw new Error('This package is quoted on request and cannot be paid online');
    const unit = money(packageRow.offer_price || packageRow.package_price || packageRow.base_price);
    if (unit <= 0) throw new Error('Package has no valid price');
    return { kind: 'package', ref: String(packageRow._id), name: `${packageRow.freezone || 'Free Zone'} — ${packageRow.package_name || 'Business Setup Package'}`, billing: 'one-time', unit_price_aed: unit, qty: 1, line_total_aed: Math.round(unit * 100) / 100, source: 'mongo:package_catalog' };
  }
  if (item.kind === 'addon') {
    const filter = item.addon_id ? { _id: item.addon_id } : { $or: [{ addon_name: item.addon_name }, { label: item.addon_name }] };
    const addon = await (await col('addon_catalog')).findOne({ ...filter, is_active: true });
    if (!addon) throw new Error('Unknown or inactive add-on');
    const unit = money(addon.price || addon.display_price);
    if (unit <= 0) throw new Error('Add-on has no valid price');
    const qty = Math.min(Math.max(Number(item.qty) || 1, 1), 50);
    return { kind: 'addon', ref: String(addon._id), name: addon.label || addon.addon_name || 'Add-on', billing: addon.unit || 'one-time', unit_price_aed: unit, qty, line_total_aed: Math.round(unit * qty * 100) / 100, source: 'mongo:addon_catalog' };
  }
  throw new Error(`Unsupported order item kind: ${item.kind}`);
}

async function isFounderMember(email, userId) {
  const snapshot = await (await col('order_fulfilments')).findOne({ customer_email: String(email).toLowerCase(), founders_club: true });
  if (snapshot) return true;
  if (!userId) return false;
  const rows = await sbGet('founder_club_memberships', `user_id=eq.${encodeURIComponent(userId)}&status=eq.active&select=id&limit=1`);
  return Boolean(rows.data?.length);
}

export async function createCustomerOrder(payload) {
  if (!Array.isArray(payload.items) || payload.items.length === 0 || payload.items.length > 25) throw new Error('At least one and no more than 25 items are required');
  const email = String(payload.contact?.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Valid contact email is required');
  const lineItems = [];
  for (const item of payload.items) lineItems.push(await priceItem(item));
  const basePrice = lineItems.filter((item) => item.kind !== 'addon').reduce((sum, item) => sum + item.line_total_aed, 0);
  const addonsTotal = lineItems.filter((item) => item.kind === 'addon').reduce((sum, item) => sum + item.line_total_aed, 0);
  const subtotal = Math.round((basePrice + addonsTotal) * 100) / 100;
  const founderMember = await isFounderMember(email, payload.user_id);
  let founderDiscount = 0;
  if (founderMember) for (const item of lineItems) {
    const percent = item.kind === 'service' ? 15 : item.kind === 'package' ? 10 : 0;
    if (percent) { item.founder_discount_pct = percent; item.founder_discount_aed = Math.round(item.line_total_aed * percent) / 100; founderDiscount += item.founder_discount_aed; }
  }
  let coupon = null;
  if (payload.coupon_code) {
    const rows = await sbGet('coupons', `code=eq.${encodeURIComponent(String(payload.coupon_code).toUpperCase())}&select=*`);
    const row = rows.data?.[0];
    if (row?.is_active !== false) {
      const value = money(row?.discount_value);
      const amount = row?.discount_type === 'pct' ? (subtotal - founderDiscount) * value / 100 : value;
      coupon = { code: row.code, applied: amount > 0, amount_aed: Math.round(Math.min(Math.max(amount, 0), subtotal - founderDiscount) * 100) / 100, discount_type: row.discount_type, discount_value: value };
    } else coupon = { code: payload.coupon_code, applied: false, amount_aed: 0, reason: 'invalid or inactive coupon' };
  }
  const discountTotal = Math.round((founderDiscount + (coupon?.amount_aed || 0)) * 100) / 100;
  const finalTotal = Math.round(Math.max(subtotal - discountTotal, 0) * 100) / 100;
  if (finalTotal <= 0 || finalTotal > MAX_ORDER_AED) throw new Error('Computed order total is invalid');
  const id = uuid();
  const orderRef = reference();
  const primary = lineItems.find((item) => item.kind !== 'addon') || lineItems[0];
  const packageItem = lineItems.find((item) => item.kind === 'package');
  const order = { id, order_ref: orderRef, customer_name: payload.contact.name || null, customer_email: email, customer_phone: `${payload.contact.phone_code || ''} ${payload.contact.phone || ''}`.trim() || null, freezone: packageItem ? (payload.zone_name || payload.zone_slug || 'Free Zone') : 'Accounting & Compliance', package_id: packageItem?.ref || null, package_name: payload.package_name || primary.name, duration_years: Number(payload.duration_years) || 1, visa_count: Number(payload.visa_count) || 0, base_price: Math.round(basePrice * 100) / 100, addons_total: Math.round(addonsTotal * 100) / 100, discount_total: discountTotal, final_total: finalTotal, currency: 'AED', status: 'draft', notes: `Ref: ${orderRef}` };
  const saved = await sbPost('checkout_orders', order);
  if (!saved.ok) throw new Error('Could not save the order');
  await (await col('order_snapshots')).insertOne({ _id: id, order_ref: orderRef, customer_email: email, customer_name: payload.contact.name || null, line_items: lineItems, base_price: basePrice, addons_total: addonsTotal, discount_total: discountTotal, final_total: finalTotal, currency: 'AED', coupon, founder_discount: { member: founderMember, amount_aed: founderDiscount }, business: payload.business || {}, created_at: now() });
  return { ...order, reference: orderRef, line_items: lineItems, coupon, founder_discount: { member: founderMember, amount_aed: founderDiscount, service_pct: founderMember ? 15 : 0, package_pct: founderMember ? 10 : 0 } };
}

export async function getCustomerOrder(id) {
  const row = await (await col('order_snapshots')).findOne({ _id: id });
  if (!row) return null;
  const { _id, ...rest } = row;
  return { id: String(_id), ...rest };
}

export async function getFounderStatus(email) {
  const member = await isFounderMember(email);
  return { email: String(email || '').toLowerCase().trim(), member, service_pct: member ? 15 : 0, package_pct: member ? 10 : 0 };
}
