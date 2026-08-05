# NZ Retail Finance Tracker

Web-based finance tracker for NZ retail/café businesses — expenses, GST reporting, costing CSV import, QR ingredient stock counts, and savings goals.

## Features

- **Manual expense entry** — Date, Purchases, Amount, Qty, Total, Payment, Category
- **Costing CSV import** — supports `costing(Purchase S).csv` with 4-bucket categories
- **Mock Gmail inbox** — invoice list (production: Gmail OAuth)
- **QR ingredient inventory** — scan + printable label sheet
- **Dashboard** — KPIs, best sellers, low-stock alerts
- **GST report** — FY 2025/26, period breakdown, IRD due-date hints
- **Savings goals** — tied to revenue − expenses surplus
- **Team access** — owner + accountant roles, Resend invite flow

## Quick start

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

| Role | Email | Password |
|------|-------|----------|
| Owner | `owner@demo.co.nz` | `demo1234` |
| Accountant | `accountant@demo.co.nz` | `demo1234` |

## Deploy

See [DEPLOY.md](./DEPLOY.md) for Vercel + Railway PostgreSQL setup.

## Stack

Next.js 16 · TypeScript · Tailwind · Prisma · NextAuth · Resend · Railway · Vercel
