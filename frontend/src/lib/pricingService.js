import { supabaseRest } from './supabaseRest';

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value, fallback = true) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return fallback;
}

function cleanRow(row = {}) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [String(key).replace(/^\uFEFF/, ''), value]));
}

function first(row, keys, fallback = null) {
  const clean = cleanRow(row);
  for (const key of keys) {
    if (clean?.[key] !== undefined && clean?.[key] !== null && clean?.[key] !== '') return clean[key];
  }
  return fallback;
}

export function normalizeFreezonePackage(input = {}) {
  const row = cleanRow(input);
  const freezoneName = first(row, ['freezone', 'freezone_name', 'jurisdiction', 'authority'], 'Free Zone');
  const packageName = first(row, ['package_name', 'name', 'title', 'category'], 'Business Setup Package');
  const slug = first(row, ['slug', 'freezone_slug'], slugify(freezoneName));
  const basePrice = num(first(row, ['display_price', 'promotion_price', 'discount_price', 'offer_price', 'package_price', 'base_price', 'original_price', 'price'], 0));
  const serviceFee = num(first(row, ['service_fee', 'advisory_fee', 'svc'], 0), 0);
  const visaCount = num(first(row, ['visa_count', 'visas', 'max_visas'], first(row, ['includes_visa'], 0)), 0);
  const durationYears = num(first(row, ['duration_years', 'validity_years'], 1), 1);
  const shareholderCount = num(first(row, ['shareholder_count', 'shareholders'], 1), 1);
  const activitiesAllowed = num(first(row, ['activities_allowed', 'activities'], 3), 3);
  const totalWithService = num(first(row, ['total_price', 'total_aed'], basePrice + serviceFee), basePrice + serviceFee);

  return {
    id: String(first(row, ['id', 'package_id'], `${slug}-${slugify(packageName)}-${basePrice}`)),
    package_id: first(row, ['package_id', 'id'], null),
    slug,
    freezone_name: freezoneName,
    package_name: packageName,
    category: first(row, ['category', 'package_type'], ''),
    base_price: basePrice,
    service_fee: serviceFee,
    total_with_service: totalWithService,
    visa_count: visaCount,
    includes_visa: first(row, ['includes_visa'], visaCount),
    duration_years: durationYears,
    duration: first(row, ['duration', 'validity'], `${durationYears} Year${durationYears > 1 ? 's' : ''}`),
    shareholder_count: shareholderCount,
    activities_allowed: activitiesAllowed,
    workspace: first(row, ['workspace', 'office_type', 'facility'], ''),
    source: first(row, ['source', 'source_status'], ''),
    is_active: bool(first(row, ['is_active', 'active'], true), true),
    raw: row,
  };
}

export function normalizePackageBenefit(input = {}) {
  const row = cleanRow(input);
  return {
    id: String(first(row, ['id'], `${first(row, ['freezone'], '')}-${first(row, ['package_name'], '')}-${first(row, ['sort_order'], '')}-${first(row, ['benefit'], '')}`)),
    slug: slugify(first(row, ['freezone', 'freezone_name'], '')),
    freezone_name: first(row, ['freezone', 'freezone_name'], ''),
    package_name: first(row, ['package_name', 'name'], ''),
    sort_order: num(first(row, ['sort_order', 'display_order'], 999), 999),
    benefit: first(row, ['benefit', 'description', 'notes'], ''),
    is_active: bool(first(row, ['is_active', 'active'], true), true),
    raw: row,
  };
}

export function normalizePackageAddon(input = {}) {
  const row = cleanRow(input);
  const name = first(row, ['addon_name', 'name', 'label', 'title'], 'Service Add-on');
  return {
    id: String(first(row, ['id', 'addon_id'], `${slugify(first(row, ['freezone', 'freezone_name'], 'global'))}-${slugify(name)}-${first(row, ['price'], '')}`)),
    addon_id: first(row, ['addon_id', 'id'], null),
    slug: slugify(first(row, ['freezone', 'freezone_name'], '')),
    freezone_name: first(row, ['freezone', 'freezone_name'], ''),
    addon_name: name,
    category: first(row, ['addon_category', 'category', 'group', 'service_group'], 'Other'),
    price: num(first(row, ['price', 'display_price', 'amount'], 0), 0),
    currency: first(row, ['currency'], 'AED'),
    unit: first(row, ['unit'], 'one-time'),
    notes: first(row, ['notes', 'description'], ''),
    is_active: bool(first(row, ['is_active', 'active'], true), true),
    raw: row,
  };
}

export function normalizePackageDiscount(input = {}) {
  const row = cleanRow(input);
  return {
    id: String(first(row, ['id'], `${first(row, ['freezone'], '')}-${first(row, ['package_name'], '')}-${first(row, ['duration'], '')}`)),
    slug: slugify(first(row, ['freezone', 'freezone_name'], '')),
    freezone_name: first(row, ['freezone', 'freezone_name'], ''),
    package_name: first(row, ['package_name', 'name'], ''),
    duration: first(row, ['duration', 'validity', 'duration_years'], ''),
    discount_percent: num(first(row, ['discount_percent', 'discount_percentage', 'discount'], 0), 0),
    applies_to: first(row, ['applies_to'], ''),
    notes: first(row, ['notes', 'description'], ''),
    is_active: bool(first(row, ['is_active', 'active'], true), true),
    raw: row,
  };
}

function bestPackageForZone(packages) {
  const active = packages.filter((pkg) => pkg.is_active !== false && pkg.base_price > 0);
  const source = active.length ? active : packages;
  return [...source].sort((a, b) => (a.base_price || a.total_with_service || 0) - (b.base_price || b.total_with_service || 0))[0] || null;
}

export async function loadFreezonePackages() {
  const attempts = [
    () => supabaseRest.select('freezone_packages', '?select=*&is_active=eq.true'),
    () => supabaseRest.select('freezone_packages', '?select=*'),
  ];

  let lastError;
  for (const attempt of attempts) {
    try {
      const rows = await attempt();
      return (rows || [])
        .map(normalizeFreezonePackage)
        .filter((pkg) => {
          if (pkg.is_active === false) return false;
          if (pkg.source && pkg.source.toLowerCase() === 'renewal') return false;
          // Hide any package whose name advertises Renewal — keep only New Registration / setup packages
          const name = String(pkg.package_name || '').toLowerCase();
          if (/(renewal|renew|all inclusive installment)/.test(name)) return false;
          return true;
        });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Could not load freezone_packages');
}

async function loadOptionalTable(table, normalizer) {
  const attempts = [
    () => supabaseRest.select(table, '?select=*&is_active=eq.true'),
    () => supabaseRest.select(table, '?select=*'),
  ];
  for (const attempt of attempts) {
    try {
      const rows = await attempt();
      return (rows || []).map(normalizer).filter((row) => row.is_active !== false);
    } catch (error) {
      // Optional table not present in this Supabase project — try next attempt.
      if (process.env.NODE_ENV !== 'production') console.debug('[pricingService] optional table attempt failed', error?.message || error);
    }
  }
  return [];
}

export async function loadFreezonePricingBundle() {
  const [packages, benefits, addons, discounts] = await Promise.all([
    loadFreezonePackages(),
    loadOptionalTable('package_benefits', normalizePackageBenefit),
    loadOptionalTable('package_addons', normalizePackageAddon),
    loadOptionalTable('package_discounts', normalizePackageDiscount),
  ]);
  return { packages, benefits, addons, discounts };
}

export function getZonePackages(packages = [], zone) {
  if (!zone) return [];
  const zoneKey = String(zone.slug || zone.name || '').toLowerCase();
  return packages.filter((pkg) => {
    const pkgSlug = String(pkg.slug || '').toLowerCase();
    const pkgName = String(pkg.freezone_name || '').toLowerCase();
    // Filter for NEW REGISTRATION only, not renewal
    const isNewRegistration = !pkg.source || pkg.source.toLowerCase() !== 'renewal';
    return (pkgSlug === zoneKey || slugify(pkg.freezone_name) === zoneKey || pkgName === String(zone.name || '').toLowerCase()) && isNewRegistration;
  }).sort((a, b) => (a.base_price || 0) - (b.base_price || 0));
}

export function getZoneBenefits(benefits = [], zone, packageName = '') {
  const zoneKey = String(zone?.slug || '').toLowerCase();
  return benefits
    .filter((item) => item.slug === zoneKey)
    .filter((item) => !packageName || !item.package_name || item.package_name === packageName || item.package_name.toLowerCase() === 'all')
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function getZoneAddons(addons = [], zone) {
  const zoneKey = String(zone?.slug || '').toLowerCase();
  return addons.filter((item) => !item.slug || item.slug === zoneKey || item.slug === 'global').sort((a, b) => a.price - b.price);
}

export function getZoneDiscounts(discounts = [], zone) {
  const zoneKey = String(zone?.slug || '').toLowerCase();
  return discounts.filter((item) => item.slug === zoneKey).sort((a, b) => String(a?.duration ?? '').localeCompare(String(b?.duration ?? '')));
}

export function mergeZoneWithLivePackage(zone, livePackages = []) {
  if (!zone) return zone;
  const matches = getZonePackages(livePackages, zone);
  const best = bestPackageForZone(matches);
  if (!best) return zone;

  const gov = best.base_price || zone.gov;
  const svc = best.service_fee || 0;
  const govVisa = best.visa_count > 0 ? best.total_with_service - svc : zone.govVisa;
  const maxVis = best.visa_count > 0 ? Math.max(zone.maxVis || 0, best.visa_count) : zone.maxVis;

  return {
    ...zone,
    gov,
    svc,
    govVisa: govVisa && govVisa > gov ? govVisa : zone.govVisa,
    maxVis,
    physical: best.workspace || zone.physical,
    livePackage: best,
    livePackages: matches,
    priceSource: 'supabase',
  };
}

export function mergeZonesWithLivePackages(zones, livePackages = []) {
  return zones.map((zone) => mergeZoneWithLivePackage(zone, livePackages));
}
