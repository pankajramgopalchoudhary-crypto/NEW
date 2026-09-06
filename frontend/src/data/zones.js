/**
 * Company constants + re-exports of the live catalog.
 *
 * Prices used to be hardcoded here. They now live in Mongo `jurisdiction_catalog`
 * / `package_catalog` and are served by `GET /api/catalog` — see `data/catalog.js`.
 * Only non-pricing company details remain literal in this file.
 */
export {
  ZONES,
  MAINLAND_ZONES,
  COMING_SOON_JURISDICTIONS,
  ADD_ONS,
  getZoneBySlug,
  loadCatalog,
} from './catalog';

export const COMPANY_INFO = {
  legalName: 'Axiscrest-Global FZE LLC',
  brand: 'SmartSetupUAE.ae',
  license: '262843696888',
  founder: 'Pankaj Choudhary',
  phone: '+971 58 590 3155',
  whatsapp: '+971 58 590 3155',
  whatsappNumber: '971585903155',
  email: 'info@smartsetupuae.ae',
  address: 'CWS-1V-000384, 26th Floor, Amber Gem Tower, Ajman, UAE',
  bank: {
    name: 'Mashreq Bank',
    branch: 'Dubai, UAE',
    swift: 'BOMLAEAD',
    accountName: 'Axiscrest-Global FZE LLC',
    accounts: [
      { currency: 'AED', iban: 'AE58 0330 0000 1234 5678 901', note: 'No conversion charge. Use your order reference as payment note.' },
      { currency: 'USD', iban: 'AE86 0330 0000 1910 1843 402', note: 'Include 5% bank conversion charge in your transfer.' },
      { currency: 'EUR', iban: 'AE56 0330 0000 1910 1843 403', note: 'Include 5% bank conversion charge in your transfer.' },
    ],
    // Backward-compat fallback
    iban: 'AE58 0330 0000 1234 5678 901',
  },
  prebookAmount: 999,
};
