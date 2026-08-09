# STLL HAUS Finance Tracker

A web app for running **STLL HAUS** day-to-day finances — expenses, NZ GST, inventory, POS sales, and invoices — built for owners and accountants.

Works in the browser on desktop and phone. On mobile, **Add to Home Screen** for a PWA-style app.

---

## Features

| Area | What it does |
|------|----------------|
| **Dashboard** | Revenue, expenses, GST paid, low-stock alerts, best sellers |
| **Expenses** | Manual entry with GST split, categories, payment modes |
| **CSV import** | Costing / purchase CSV with 4-bucket categorisation |
| **POS sync** | Pull products & sales from STLL Haus POS (Postgres) |
| **Invoices** | Invoice list (manual / imported records) |
| **Inventory** | Ingredients, par levels, QR labels, camera stock counts |
| **Reports** | Sales charts + GST periods with IRD-oriented due dates |
| **Goals** | Savings targets linked to surplus (revenue − expenses) |
| **Team** | Owner + accountant roles, invite flow via Resend |

---

## Quick start (local)

Local and production both use **PostgreSQL** (Railway, Neon, or Docker). See [DEPLOY.md](./DEPLOY.md).

```bash
cp .env.example .env
# set DATABASE_URL to your postgresql://... connection string
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo logins

| Role | Email | Password |
|------|-------|----------|
| Owner | `owner@stllhaus.co.nz` | `demo1234` |
| Accountant | `accountant@stllhaus.co.nz` | `demo1234` |

### Mobile

Safari / Chrome → Share / Menu → **Add to Home Screen**. Use the Scan QR tab with the rear camera for stock counts.

---

## Deploy (Vercel + Railway)

Full steps: **[DEPLOY.md](./DEPLOY.md)**

### Required environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Railway Postgres connection string |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | Auth.js secrets (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Public app URL |

### Optional

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Accountant invite emails |
| `POS_DATABASE_URL` / `POS_PRESET` | POS sales sync |

---

## Docs

- [Deploy (Vercel + Railway)](./DEPLOY.md)
- [POS integration](./docs/POS-INTEGRATION.md)

---

## Stack

**Next.js 16** · **React 19** · **TypeScript** · **Tailwind CSS** · **Prisma** · **NextAuth (Auth.js)** · **Resend** · **Vercel** · **Railway**

---

## License

Private / proprietary for STLL HAUS unless otherwise noted.
