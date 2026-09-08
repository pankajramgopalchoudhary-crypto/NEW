# SmartSetupUAE Hostinger deployment package

This bundle is the Hostinger Node-only deployment source package.

- ## Included
- Next.js Node app with customer and admin `/api/*` routes
- React customer frontend source
- Sanitized environment templates
- Hostinger Node deployment guidance

## Files
- admin/.env.example
- frontend/.env.example
- backend/.env.example

## Production setup
1. Deploy the `admin` directory as the Hostinger Node application.
2. Add the real admin environment variables in Hostinger, using `admin/.env.example`.
3. Build the React frontend with `REACT_APP_BACKEND_URL=https://admin.smartsetupuae.ae`.
4. Publish the resulting `frontend/build` directory on the public website.
5. Do not deploy the Python directory for the Hostinger-only target.

## Important
- Never commit real secrets.
- Keep MONGO_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_JWT_SECRET, RESEND_API_KEY, and STRIPE_API_KEY server-side only.
- Do not expose secret values in NEXT_PUBLIC_* or REACT_APP_* variables.

## Deployment split
- Node/Next.js app: Hostinger Node.js at `admin.smartsetupuae.ae`
- Customer frontend: static React build on the public site
- Customer API: Node/Next.js `/api/*` routes in the same Hostinger app

The Node-only migration is not complete until `npm run verify:hostinger` passes.
That gate intentionally fails while customer route groups are still being ported.

The structural gate passed in this workspace with dummy values and no missing
customer route groups. Live deployment still requires real `MONGO_URL`,
Supabase, Resend, Stripe, Gemini, and admin secret values. OCR and passport
photo routes also require their provider keys before those features can operate.

## Verified runtime check
The admin app build has passed in this workspace.
