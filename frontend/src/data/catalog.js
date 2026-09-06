/**
 * Live catalog store.
 *
 * Jurisdiction, package and add-on prices are NOT bundled into the app any
 * more — they come from `GET /api/catalog`, which reads the canonical Mongo
 * catalog that admin edits. The exported arrays are filled **in place** on
 * load so existing imports (`import { ZONES } from '../data/zones'`) keep
 * working without touching every page.
 */
import { catalogApi } from '../lib/backendApi';

export const ZONES = [];
export const MAINLAND_ZONES = [];
export const COMING_SOON_JURISDICTIONS = [];
export const ADD_ONS = [];
export const FREEZONE_PACKAGES = [];
export const PACKAGE_ADDONS = [];
export const PACKAGE_DISCOUNTS = [];

function refill(target, rows) {
  target.length = 0;
  (rows || []).forEach((row) => target.push(row));
  return target;
}

let inflight = null;
export let catalogLoaded = false;

export function loadCatalog() {
  if (inflight) return inflight;
  inflight = catalogApi
    .all()
    .then((data) => {
      refill(ZONES, data.jurisdictions);
      refill(MAINLAND_ZONES, data.mainland);
      refill(COMING_SOON_JURISDICTIONS, data.coming_soon);
      refill(ADD_ONS, data.addons);
      refill(FREEZONE_PACKAGES, data.packages);
      refill(PACKAGE_ADDONS, data.package_addons);
      refill(PACKAGE_DISCOUNTS, data.package_discounts);
      catalogLoaded = true;
      return data;
    })
    .catch((error) => {
      inflight = null;
      throw error;
    });
  return inflight;
}

export const getZoneBySlug = (slug) =>
  [...ZONES, ...MAINLAND_ZONES].find((zone) => zone.slug === slug);
