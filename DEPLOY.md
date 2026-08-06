# Deploy — Vercel + Railway

## 1. Railway (PostgreSQL)

1. Create a project at [railway.app](https://railway.app)
2. Add **PostgreSQL**
3. Copy the **public** `DATABASE_URL` (must start with `postgresql://`)
4. Run migrate + seed once from your machine:
   ```bash
   DATABASE_URL="postgresql://..." npx prisma migrate deploy
   DATABASE_URL="postgresql://..." npm run db:seed
   ```

## 2. Vercel (Next.js app)

1. Import https://github.com/shaygail/finance-tracker
2. Project → **Settings → Environment Variables** (Production):

| Name | Value |
|------|--------|
| `DATABASE_URL` | Railway public Postgres URL |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_SECRET` | same as `AUTH_SECRET` |
| `NEXTAUTH_URL` | `https://YOUR-APP.vercel.app` |
| `MOCK_GMAIL` | `true` |

Optional: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`

3. Redeploy. Build runs `prisma migrate deploy` then `next build`.

### Common build failure

```
The datasource.url property is required in your Prisma config file when using prisma migrate deploy.
```

**Cause:** `DATABASE_URL` is not set (or not available at **build** time) in Vercel.

**Fix:** Vercel → Project → **Settings → Environment Variables** → add:

- Key: `DATABASE_URL`
- Value: Railway **public** Postgres URL (`postgresql://...`)
- Environments: **Production** (and Preview)
- Save → **Deployments → Redeploy**

Do not use `file:./dev.db` on Vercel.

## 3. Local development

Use the same Railway/Neon Postgres URL in `.env` (or a local Docker Postgres):

```bash
cp .env.example .env
# set DATABASE_URL to postgresql://...
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Demo login: `owner@stllhaus.co.nz` / `demo1234`

## Stack

- **App:** Vercel (Next.js 16, TypeScript, Tailwind)
- **Database:** Railway / Neon PostgreSQL
- **Email:** Resend (accountant invites), Gmail OAuth (invoice inbox)
- **Auth:** NextAuth credentials
