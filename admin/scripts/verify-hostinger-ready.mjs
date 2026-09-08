import { existsSync, readFileSync } from 'node:fs';

const required = [
  'MONGO_URL',
  'DB_NAME',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ADMIN_JWT_SECRET',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'STRIPE_API_KEY',
  'GEMINI_API_KEY',
  'EMERGENT_LLM_KEY',
];

const placeholders = /^(YOUR_|CHANGE_ME|GENERATE_WITH|re_x+|sk_(live|test)_x+)/i;
const missing = required.filter((key) => !process.env[key]);
const placeholder = required.filter((key) => placeholders.test(process.env[key] || ''));
const forbidden = ['SUPABASE_SERVICE_ROLE_KEY', 'MONGO_URL', 'ADMIN_JWT_SECRET', 'RESEND_API_KEY']
  .filter((key) => process.env[key] && (process.env[key].includes('YOUR_') || process.env[key].includes('CHANGE_ME')));

const routeFile = new URL('../app/api/[[...path]]/route.js', import.meta.url);
const routeSource = existsSync(routeFile) ? readFileSync(routeFile, 'utf8') : '';
const nodeOnlyCustomerRoutes = [
  '/catalog', '/services', '/orders', '/payments', '/auth/signup',
  '/lifecycle', '/support/tickets', '/ocr', '/photo/passportize',
  '/careers', '/referral', '/aria/smart-rank', '/aria/save-lead',
];
const missingCustomerRoutes = nodeOnlyCustomerRoutes.filter((route) => !routeSource.includes(`'${route}`) && !routeSource.includes(`"${route}`));

if (missing.length || placeholder.length || forbidden.length || missingCustomerRoutes.length) {
  console.error(JSON.stringify({ ok: false, missing, placeholder, forbidden, missingCustomerRoutes }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checked: required.length, missingCustomerRoutes: [] }, null, 2));