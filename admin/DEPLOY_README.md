# SmartSetupUAE Admin Panel — Hostinger Deployment Guide

> Production build of the Next.js 15 admin panel.  
> **Setup Smart. Grow Fast.**

This ZIP contains everything needed to deploy `admin.smartsetupuae.ae` on your Hostinger plan with Node.js support.

---

## ⚠️ SECURITY FIRST — what is NOT in this ZIP (intentionally)

The following files are **excluded** for security. You will create / configure them on Hostinger after upload:

- ❌ `.env` (real keys)
- ❌ `.git/`, `.gitignore`
- ❌ `node_modules/` (will be installed by Hostinger)
- ❌ `.next/cache/` (build cache, regenerated)
- ❌ Internal docs (ADMIN_PANEL_WORKFLOW.md, test_result.md)
- ❌ Patches, scratch files, /tmp
- ❌ The /app/repo_clone folder (your other React+FastAPI repo)

What IS in this ZIP:
- ✅ All source code under `/app/`, `/components/`, `/lib/`
- ✅ Pre-built `.next/` production bundle
- ✅ `package.json`, `package-lock.json`, `yarn.lock`
- ✅ `next.config.js`, `tailwind.config.js`, `postcss.config.js`
- ✅ `public/` static assets
- ✅ `.env.example` (template — DO NOT contains real secrets)
- ✅ This README

---

## 📋 Pre-flight checklist (before upload)

You should have **all 4** ready:

1. **A MongoDB connection string.** Options:
   - **Easiest**: free MongoDB Atlas cluster → https://www.mongodb.com/cloud/atlas/register → create M0 free cluster → "Connect" → "Drivers" → copy `mongodb+srv://...` string
   - Or use Hostinger MongoDB if your plan includes it
2. **Supabase keys** (you already have them):
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **Resend API key** (already verified on `smartsetupuae.ae`):
   - `re_4PWcv6uU_LWNwNX6dgVMfbMtSzczkU64Z`
4. **Gemini API key**:
   - `AQ.Ab8RN6L2GmpuPIz9fVLB18s-xPgJh4aZ7TTKnLVD-QSDV8NMmQ`

---

## 🚀 Step-by-step Hostinger deployment

### Step 1 — Create a subdomain for admin (recommended)

Don't put admin at `smartsetupuae.ae/admin` (clashes with your public website routes). Use a clean subdomain:

1. In hPanel → **Domains** → **Subdomains** → **+ Create Subdomain**
2. Subdomain: `admin`
3. Domain: `smartsetupuae.ae`
4. **Custom folder**: `domains/admin.smartsetupuae.ae/public_html` (Hostinger sets this automatically)
5. Click **Create**

You now have `admin.smartsetupuae.ae` pointing at its own folder, isolated from your public website at `smartsetupuae.ae`.

### Step 2 — Upload the ZIP

**Option A — via File Manager (easy, no terminal)**
1. hPanel → **Files** → **File Manager**
2. Navigate to `domains/admin.smartsetupuae.ae/public_html`
3. Drag-and-drop `smartsetupuae-admin-deploy.zip` into the file manager
4. Right-click the ZIP → **Extract** → confirm
5. Delete the ZIP after extraction
6. You should now see folders `.next/`, `app/`, `components/`, `lib/`, `public/`, `node_modules.txt`, etc.

**Option B — via FTP** (if file > 256 MB)
1. Use FileZilla / Cyberduck
2. Host: `ftp://smartsetupuae.ae`, User: `u821690512.smartsetupuae.ae`, Password: from hPanel → Files → FTP Accounts
3. Upload to `/domains/admin.smartsetupuae.ae/public_html/`
4. Extract the ZIP via File Manager after upload

### Step 3 — Configure Node.js app on Hostinger

1. hPanel → **Advanced** → **Node.js** (or **Hosting Plan** → **Deployments** in the new UI)
2. Click **+ Create Application**
3. Settings:
   - **Node.js version**: `22.x` (or `20.x` — both work)
   - **Application mode**: `Production`
   - **Application root**: `domains/admin.smartsetupuae.ae/public_html`
   - **Application URL**: `https://admin.smartsetupuae.ae`
   - **Application startup file**: `node_modules/next/dist/bin/next` with args `start -p $PORT -H 0.0.0.0`
   - Or use the simpler form: **Startup command**: `yarn start`
4. Click **Create**

### Step 4 — Add Environment Variables (the critical step)

1. hPanel → **Advanced** → **Environment Variables** (or **Node.js app** → **Environment Variables**)
2. Open `.env.example` from the ZIP to see the full list
3. Add **each variable one-by-one** with its real value:

| Key | Value |
|---|---|
| `MONGO_URL` | your MongoDB connection string |
| `DB_NAME` | `smartsetupuae_admin` |
| `NEXT_PUBLIC_BASE_URL` | `https://admin.smartsetupuae.ae` |
| `CORS_ORIGINS` | `https://smartsetupuae.ae,https://www.smartsetupuae.ae,https://admin.smartsetupuae.ae` |
| `SUPABASE_URL` | `https://smrsaedmuaizlesehpee.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | your full service_role JWT |
| `NEXT_PUBLIC_SUPABASE_URL` | same as `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon JWT |
| `ADMIN_JWT_SECRET` | generate fresh: run `openssl rand -base64 48` locally, paste result |
| `FOUNDER_EMAIL` | `admin@smartsetupuae.ae` |
| `FOUNDER_PASSWORD` | a STRONG password (change at first login from Settings) |
| `RESEND_API_KEY` | your Resend key |
| `RESEND_FROM_EMAIL` | `SmartSetupUAE <noreply@smartsetupuae.ae>` |
| `GEMINI_API_KEY` | your Gemini key |

4. **Save**.

> 🔒 **Important**: NEVER paste these values into source code or commit them anywhere. Hostinger's Environment Variables panel is the right place — they're injected at runtime, never in the ZIP.

### Step 5 — Install dependencies + start

In hPanel → **Node.js** → your app → click **NPM Install** (or **Yarn Install**).  
Wait 1-3 minutes for `node_modules/` to be installed.

Then click **Start Application** (or **Restart** if it auto-started).

### Step 6 — Verify

1. Open https://admin.smartsetupuae.ae/admin/login in your browser
2. Login as Founder using your `FOUNDER_EMAIL` / `FOUNDER_PASSWORD`
3. Check the dashboard loads with Founders Club counters
4. Click around — every page should load
5. Go to **Settings** → change the Founder password from the default

### Step 7 — Hardening (do this before going live)

1. **Change the founder password** from the seeded default (Settings → Change Founder Password)
2. **Rotate the JWT secret** if it leaked anywhere — just update `ADMIN_JWT_SECRET` in Environment Variables + Restart (this invalidates all existing sessions)
3. **Lock CORS down** to ONLY your public website domain (remove `*`)
4. **Enable HTTPS-only** in hPanel → SSL → force HTTPS redirect (Hostinger usually does this by default for Let's Encrypt)
5. **Disable the auto-seed default users** for non-founder roles by setting `DISABLE_AUTO_SEED=true` in env (if you want to manually create all 4)

---

## 🩺 Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| 502 Bad Gateway | Node app crashed | hPanel → Node.js → check **Runtime Logs** for the actual error. Usually missing env var. |
| Cannot connect to MongoDB | Wrong `MONGO_URL` or IP not whitelisted | If using Atlas, go to Atlas → Network Access → add `0.0.0.0/0` (for testing) or Hostinger's egress IP |
| Login works but dashboard 401 | `ADMIN_JWT_SECRET` differs between server restarts | Set a stable value in Environment Variables, never auto-generate |
| Supabase queries return 401 | `SUPABASE_SERVICE_ROLE_KEY` truncated | Keys are ~250 chars; copy carefully from Supabase dashboard |
| Aria AI returns "model not found" | Old Gemini model name | Code uses `gemini-2.5-flash` which is current. If issue persists, set `GEMINI_MODEL=gemini-2.5-flash` explicitly. |
| PIN emails don't arrive | `RESEND_FROM_EMAIL` domain not verified in Resend dashboard | You already verified ✅ — should work. Check Resend → Logs to see deliveries. |
| Build fails on `yarn install` | Node version too old | Set Node version to `22.x` in hPanel |
| Public website breaks after admin upload | Wrong folder | Make sure admin is in its own subdomain folder, NOT in `smartsetupuae.ae/public_html` |

---

## 🔄 Updating in the future

When you have a new ZIP (e.g. after a feature update):

1. **Backup** your current Environment Variables (copy to a safe note) — they're already on the server, don't re-enter them, but just in case.
2. Upload the new ZIP to the same folder
3. Right-click → Extract → choose **Overwrite all**
4. In hPanel → Node.js → click **Restart Application**

Environment Variables persist across restarts.

---

## 📋 Default test credentials (CHANGE AFTER FIRST LOGIN)

These are seeded on first request if no `admin_users` exist in Mongo:

| Role | Email / Username | Password / PIN |
|---|---|---|
| Founder | `admin@smartsetupuae.ae` | `Admin@2026` |
| Manager | `manager@smartsetupuae.ae` | `Manager@2026` |
| Staff | `staff01` | PIN `1234` |
| Reviewer | `reviewer01` | PIN `5678` |

**🚨 Change these IMMEDIATELY after first login** via Settings → Change Password (for Founder/Manager) and Staff & Access → Reset PIN (for Staff/Reviewer).

---

## ✅ Quick health check after deploy

Open these URLs in your browser:

- `https://admin.smartsetupuae.ae` → should redirect to `/admin/login`
- `https://admin.smartsetupuae.ae/admin/login` → 4-role login form, NO default credentials shown
- `https://admin.smartsetupuae.ae/api` → should return `{"ok":true,"service":"SmartSetupUAE Admin API",...}`
- `https://admin.smartsetupuae.ae/api/admin/seed` (POST) → seeds users; returns `{"seeded":true,"count":4}` first time, `{"seeded":false,"count":4}` on subsequent calls

If all 4 respond correctly, you're good. 🎉

---

## 📞 Need help?

If something doesn't work after following all steps, capture:
1. hPanel → Node.js → **Runtime Logs** (last 100 lines)
2. Browser DevTools → Network tab → screenshot of any failing request

— Built with care for SmartSetupUAE — Setup Smart. Grow Fast.
