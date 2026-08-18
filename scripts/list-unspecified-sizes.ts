import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  isCupSaleItem,
  classifyDrinkSize,
  siblingSizeFromSaleLines,
  expandCupLines,
} from "../src/lib/cups";
import { canonicalizeProductName } from "../src/lib/pos/product-aliases";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });
  const business = await db.business.findFirst();
  if (!business) throw new Error("no business");

  const lines = await db.saleLine.findMany({
    where: { sale: { businessId: business.id } },
    select: {
      saleId: true,
      productName: true,
      notes: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,
      sale: { select: { soldAt: true } },
      product: { select: { sku: true } },
    },
  });

  const bySale = new Map<string, typeof lines>();
  for (const l of lines) {
    const list = bySale.get(l.saleId) ?? [];
    list.push(l);
    bySale.set(l.saleId, list);
  }
  const sibling = new Map<string, ReturnType<typeof siblingSizeFromSaleLines>>();
  for (const [id, ls] of bySale) sibling.set(id, siblingSizeFromSaleLines(ls));

  const expanded = expandCupLines(
    lines.map((l) => ({
      productName: l.productName,
      quantity: l.quantity,
      lineTotal: l.lineTotal,
      unitPrice: l.unitPrice,
      notes: l.notes,
      sku: l.product?.sku ?? null,
      siblingSize: sibling.get(l.saleId) ?? null,
      soldAt: l.sale.soldAt,
    }))
  );

  type Agg = {
    cups: number;
    revenue: number;
    first: string;
    last: string;
    prices: Record<string, number>;
  };
  const byName = new Map<string, Agg>();
  let total = 0;
  let revenue = 0;

  for (const l of expanded) {
    if (!isCupSaleItem(l.productName, l.sku)) continue;
    const qty = Number(l.quantity) || 0;
    const unit =
      l.unitPrice == null
        ? NaN
        : Number(l.unitPrice) || (qty > 0 ? Number(l.lineTotal) / qty : 0) || 0;
    const { size } = classifyDrinkSize(
      l.productName,
      l.notes,
      l.siblingSize,
      l.soldAt,
      Number.isFinite(unit) && unit > 0 ? unit : null
    );
    if (size !== "other") continue;

    const date = (l.soldAt ?? new Date(0)).toISOString().slice(0, 10);
    const priceKey =
      Number.isFinite(unit) && unit > 0
        ? String(Math.round(unit * 100) / 100)
        : "no-price";
    total += qty;
    revenue += Number(l.lineTotal) || 0;
    const name = canonicalizeProductName(l.productName);

    const cur = byName.get(name) ?? {
      cups: 0,
      revenue: 0,
      first: date,
      last: date,
      prices: {},
    };
    cur.cups += qty;
    cur.revenue += Number(l.lineTotal) || 0;
    if (date < cur.first) cur.first = date;
    if (date > cur.last) cur.last = date;
    cur.prices[priceKey] = (cur.prices[priceKey] ?? 0) + qty;
    byName.set(name, cur);
  }

  console.log(
    JSON.stringify(
      {
        totalUnspecifiedCups: Math.round(total * 100) / 100,
        totalUnspecifiedRevenue: Math.round(revenue * 100) / 100,
        products: [...byName.entries()]
          .map(([productName, v]) => ({
            productName,
            cups: Math.round(v.cups * 100) / 100,
            revenue: Math.round(v.revenue * 100) / 100,
            first: v.first,
            last: v.last,
            prices: v.prices,
          }))
          .sort((a, b) => b.cups - a.cups),
      },
      null,
      2
    )
  );

  await db.$disconnect();
  await pool.end();
}

main();
