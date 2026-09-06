/**
 * Package data now lives in Mongo `package_catalog` and is served by
 * `GET /api/catalog`. These are re-exports of the live arrays so existing
 * imports keep working — see `data/catalog.js`.
 */
export {
  FREEZONE_PACKAGES,
  PACKAGE_ADDONS,
  PACKAGE_DISCOUNTS,
  loadCatalog,
} from './catalog';
