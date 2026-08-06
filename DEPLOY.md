# Deploy — Vercel + Railway (or Railway-only)

## 1. Railway PostgreSQL (required)

1. [railway.app](https://railway.app) → **New Project** → **PostgreSQL**  
   (use a **new** database — not the stllhaus-pos DB)
2. Open the Postgres service → **Variables** / **Connect**
3. Copy `DATABASE_URL` (public URL for Vercel; private URL is fine if the app also runs on Railway)

### If the **app** also deploys on Railway

In the **same project**:

1. **New** → **GitHub Repo** → `shaygail/finance-tracker`
2. Open the **web service** → **Variables** → **Add variable**:
   - `DATABASE_URL` = reference from Postgres  
     (Railway UI: **Add variable** → **Add reference** → Postgres → `DATABASE_URL`)
   - `AUTH_SECRET` = long random string
   - `NEXTAUTH_SECRET` = same as `AUTH_SECRET`
   - `NEXTAUTH_URL` = your Railway public URL (e.g. `https://….up.railway.app`)
   - `MOCK_GMAIL` = `true`
3. Redeploy the web service

Without linking `DATABASE_URL` to the web service, `npm install` / migrate will fail.

## 2. Vercel (Next.js app) — optional if using Railway for the app

1. Import https://github.com/shaygail/finance-tracker
2. **Settings → Environment Variables** (Production):

| Name | Value |
|------|--------|
| `DATABASE_URL` | Railway **public** Postgres URL |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_SECRET` | same as `AUTH_SECRET` |
| `NEXTAUTH_URL` | `https://YOUR-APP.vercel.app` |
| `MOCK_GMAIL` | `true` |

3. Redeploy

## 3. Seed (once)

```bash
DATABASE_URL="postgresql://..." npm run db:seed
```

Demo: `owner@stllhaus.co.nz` / `demo1234`

## Common errors

**`DATABASE_URL is missing for Prisma`** during Railway/Vercel build  
→ Add `DATABASE_URL` on the **service that builds** (web app), not only on the Postgres service. On Railway use a **variable reference** from Postgres.

**Do not** use `file:./dev.db` on Railway or Vercel.

## Local development

```bash
cp .env.example .env
# set DATABASE_URL to postgresql://...
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

## Stack

- **App:** Vercel and/or Railway (Next.js 16)
- **Database:** Railway PostgreSQL
- **Email:** Resend, Gmail OAuth
- **Auth:** NextAuth credentials
