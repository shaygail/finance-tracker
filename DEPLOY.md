# Deploy

## Recommended: Railway only (app + database)

Vercel **cannot** use Railway’s private URL (`*.railway.internal`).  
Easiest path: run the **Next.js app on Railway** next to Postgres.

### 1. Postgres
1. [railway.app](https://railway.app) → project → **PostgreSQL**
2. Leave it running (internal URL is fine here)

### 2. Web service
1. Same project → **New** → **GitHub Repo** → `shaygail/finance-tracker`
2. Open the **web** service → **Variables** → add:

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | **Variable reference** → Postgres → `DATABASE_URL` |
| `AUTH_SECRET` | long random string |
| `NEXTAUTH_SECRET` | same as `AUTH_SECRET` |
| `NEXTAUTH_URL` | your Railway public URL (`https://….up.railway.app`) — set after step 3 |
| `MOCK_GMAIL` | `true` |

3. **Settings → Networking → Public Networking** → generate domain  
4. Set `NEXTAUTH_URL` to that `https://….up.railway.app` URL  
5. Redeploy  

`railway.toml` runs migrations on start (`prisma migrate deploy`).

### 3. Seed once
From your PC (use **public** DB URL from Postgres → Variables → `DATABASE_PUBLIC_URL`):

```bash
DATABASE_URL="postgresql://...proxy.rlwy.net..." npm run db:seed
```

Demo login: `owner@stllhaus.co.nz` / `demo1234`

Share the Railway `*.up.railway.app` link with your accountant.

---

## Optional: Vercel (needs public DB URL)

Vercel builds no longer run migrations (so they won’t fail on DB).  
The **running app** still needs a reachable Postgres URL:

1. Railway Postgres → Variables → copy **`DATABASE_PUBLIC_URL`** (`proxy.rlwy.net`)
2. Vercel env `DATABASE_URL` = that public URL (**not** `.railway.internal`)
3. Also set `AUTH_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `MOCK_GMAIL`
4. Run migrate once from your PC:
   ```bash
   DATABASE_URL="postgresql://...proxy.rlwy.net..." npm run db:deploy
   DATABASE_URL="postgresql://...proxy.rlwy.net..." npm run db:seed
   ```

If `DATABASE_URL` on Vercel still contains `.railway.internal`, login/pages that hit the DB will fail.

---

## Local

```bash
cp .env.example .env
# DATABASE_URL=postgresql://...
npm install
npm run db:deploy
npm run db:seed
npm run dev
```
