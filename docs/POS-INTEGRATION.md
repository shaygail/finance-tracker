# POS Database Integration — STLL HAUS

Connect your **STLL Haus POS** (Railway) database to sync **menu items** and **sales history** into the finance tracker. All queries are read-only (`SELECT` only).

## Your POS

| | |
|---|---|
| **API** | https://stllhaus-pos-production.up.railway.app |
| **Preset** | `POS_PRESET=stllhaus` (already mapped to your schema) |

The finance tracker reads directly from the **PostgreSQL database** behind that API — not the HTTP URL.

## 1. Get the database URL from Railway

1. Open [railway.app](https://railway.app) → your **stllhaus-pos** project
2. Click the **PostgreSQL** service (not the web/API service)
3. Go to **Connect** → copy the **Postgres connection URL**
   - Use **Public URL** if syncing from your Mac
   - Use **Private URL** when both apps run on Railway

It looks like:

```
postgresql://postgres:xxxxx@containers-us-west-xxx.railway.app:5432/railway
```

## 2. Add to `.env`

In the finance tracker project:

```env
POS_PRESET=stllhaus
POS_DATABASE_URL="postgresql://postgres:PASSWORD@HOST:PORT/railway"
POS_DATABASE_SSL=true
```

Railway Postgres requires SSL — keep `POS_DATABASE_SSL=true`.

## 3. Sync

1. Restart the dev server (`npm run dev`)
2. Log in as owner → **Settings** → **POS Integration**
3. Click **Sync from POS now**

First sync imports all menu items + sales. Later syncs are incremental (since last sync).

## STLL Haus schema (automatic with preset)

| Our concept | POS table | Columns |
|-------------|-----------|---------|
| Products | `menu_items` | `id`, `name`, `category` (as SKU), `price` |
| Sales | `sales` | `id`, `date`, `subtotal − discount`, `payment_method` |
| Line items | `sales.items` (JSON) | `{ id, name, price, quantity }` per item |

No separate `order_items` table — line items live inside each sale row as JSON.

## 4. What gets updated

- **Products** — menu items, prices, units sold, revenue
- **Sales Report** — daily revenue, best sellers, recent orders
- **Dashboard** — revenue KPIs
- **GST Report** — output GST from POS sales
- **Savings goals** — surplus from POS revenue − expenses

## Troubleshooting

**“POS_DATABASE_URL is not set”** — add the env vars and restart the dev server.

**Connection refused / timeout** — use Railway’s **public** Postgres URL from your local machine, or check firewall/VPN.

**SSL error** — set `POS_DATABASE_SSL=true`.

**Sync runs but 0 sales** — confirm the `sales` table has rows in Railway (POS → Data or run `SELECT COUNT(*) FROM sales`).

If sync fails with a column error, share the error message and we can adjust the mapping.
