# POS Database Integration — STLL HAUS

Connect your **STLL Haus POS** to sync **menu items** and **sales history** into the finance tracker. Sync is read-only.

## Your POS

| | |
|---|---|
| **Public API** | https://stllhaus-pos-production.up.railway.app |
| **Preset** | `POS_PRESET=stllhaus` |

## Recommended: sync via public API

In the finance tracker `.env`:

```env
POS_PRESET=stllhaus
POS_API_URL=https://stllhaus-pos-production.up.railway.app
```

Then restart the app → **Settings** → **Sync from POS now**.

Endpoints used:

- `GET /menu` — products
- `GET /sales` — orders + line items (with modifiers in `description`)

## Alternative: direct Postgres

Only needed if the HTTP API is unavailable.

1. Railway → **stllhaus-pos** → PostgreSQL → **Connect**
2. Copy the **Public** URL (`*.proxy.rlwy.net`), not `*.railway.internal`
3. Set:

```env
POS_PRESET=stllhaus
POS_DATABASE_URL="postgresql://postgres:PASSWORD@HOST:PORT/railway"
POS_DATABASE_SSL=true
```

`POS_API_URL` takes priority when both are set.

## What gets updated

- **Products** — menu items, prices, units sold, revenue
- **Sales Report** — daily revenue, best sellers, recent orders (customer + modifiers)
- **Dashboard** — revenue KPIs
- **GST Report** — output GST from POS sales
- **Savings goals** — surplus from POS revenue − expenses

## Troubleshooting

**“POS is not configured”** — set `POS_API_URL` (or `POS_DATABASE_URL`) and restart.

**Connection refused / timeout (database mode)** — use Railway’s public Postgres URL from your machine.

**SSL error** — set `POS_DATABASE_SSL=true`.

**Sync runs but 0 sales** — confirm `/sales` returns rows, or the Postgres `sales` table has data.
