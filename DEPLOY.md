# Deploy — Vercel + Railway

## 1. Railway (PostgreSQL)

1. Create a project at [railway.app](https://railway.app)
2. Add **PostgreSQL** plugin
3. Copy the **public** `DATABASE_URL`
4. In `prisma/schema.prisma`, set `provider = "postgresql"`
5. Run migrations against Railway:
   ```bash
   DATABASE_URL="postgresql://..." npx prisma migrate deploy
   DATABASE_URL="postgresql://..." npm run db:seed
   ```

## 2. Vercel (Next.js app)

1. Import https://github.com/shaygail/finance-tracker
2. Add environment variables:
   - `DATABASE_URL` — Railway Postgres URL
   - `NEXTAUTH_SECRET` — random string (`openssl rand -base64 32`)
   - `NEXTAUTH_URL` — your Vercel URL
   - `MOCK_GMAIL=true`
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — optional, for real Gmail invoice sync (see `docs/GMAIL-INTEGRATION.md`)
   - `RESEND_API_KEY` — optional, for accountant invites
3. Deploy — build runs `prisma migrate deploy` automatically (see `vercel.json`)

## 3. Local development

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Demo login: `owner@stllhaus.co.nz` / `demo1234`

## Stack

- **App:** Vercel (Next.js 16, TypeScript, Tailwind)
- **Database:** Railway PostgreSQL (SQLite for local demo only)
- **Email:** Resend (accountant invites), Gmail OAuth (invoice inbox)
- **Auth:** NextAuth credentials
