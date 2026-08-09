import "dotenv/config";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { calculateGstFromInc } from "../src/lib/gst/nz";
import { syncGoalsFromSurplus } from "../src/lib/surplus";

function parseNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,\s]/g, "").trim();
    if (!cleaned) return 0;
    const n = parseFloat(cleaned);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function parseSoldAt(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) return new Date(date.y, date.m - 1, date.d, date.H || 0, date.M || 0);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // M/D/YYYY H:mm or D/M/YYYY
  const m = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/
  );
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    const hour = m[4] ? parseInt(m[4], 10) : 12;
    const minute = m[5] ? parseInt(m[5], 10) : 0;
    // Sales sheet uses US-style M/D/YYYY (e.g. 2/27/2026)
    const month = a;
    const day = b;
    return new Date(year, month - 1, day, hour, minute);
  }

  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizePayment(raw: string): string {
  const p = raw.trim().toLowerCase();
  if (!p) return "Other";
  if (p.includes("cash")) return "Cash";
  if (p.includes("bank")) return "Bank Transfer";
  if (p.includes("eftpos") || p.includes("card")) return "EFTPOS";
  if (p.includes("afterpay")) return "Card/AfterPay";
  return raw.trim() || "Other";
}

async function recalculateProductStats(
  db: PrismaClient,
  businessId: string
): Promise<void> {
  const products = await db.product.findMany({ where: { businessId } });
  for (const product of products) {
    const agg = await db.saleLine.aggregate({
      where: { productId: product.id },
      _sum: { quantity: true, lineTotal: true },
    });
    await db.product.update({
      where: { id: product.id },
      data: {
        unitsSold: agg._sum.quantity ?? 0,
        revenue: agg._sum.lineTotal ?? 0,
      },
    });
  }
}

async function main() {
  const filePath =
    process.argv[2] ||
    path.join(process.env.USERPROFILE || "", "Downloads", "costing(Sales S).csv");

  if (!fs.existsSync(filePath)) {
    console.error("File not found:", filePath);
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("postgres")) {
    console.error("DATABASE_URL must be a postgres URL");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  const db = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const business = await db.business.findFirst({
      orderBy: { createdAt: "asc" },
    });
    if (!business) {
      console.error("No business found — run npm run db:seed first");
      process.exit(1);
    }

    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

    if (raw.length < 2) {
      console.error("Sales spreadsheet is empty");
      process.exit(1);
    }

    // Clear previous CSV sales imports (keep POS sync sales)
    const oldCsvSales = await db.sale.findMany({
      where: { businessId: business.id, posSaleId: { startsWith: "csv:" } },
      select: { id: true },
    });
    if (oldCsvSales.length) {
      await db.saleLine.deleteMany({
        where: { saleId: { in: oldCsvSales.map((s) => s.id) } },
      });
      await db.sale.deleteMany({
        where: { id: { in: oldCsvSales.map((s) => s.id) } },
      });
    }

    let imported = 0;
    let skipped = 0;
    let totalRevenue = 0;
    const productCache = new Map<string, string>();

    async function ensureProduct(name: string): Promise<string> {
      const key = name.trim().toLowerCase();
      if (productCache.has(key)) return productCache.get(key)!;

      const existing = await db.product.findFirst({
        where: { businessId: business!.id, name: { equals: name.trim(), mode: "insensitive" } },
      });
      if (existing) {
        productCache.set(key, existing.id);
        return existing.id;
      }

      const created = await db.product.create({
        data: {
          businessId: business!.id,
          name: name.trim(),
          unitPrice: 0,
          unitsSold: 0,
          revenue: 0,
        },
      });
      productCache.set(key, created.id);
      return created.id;
    }

    for (let i = 1; i < raw.length; i++) {
      const row = raw[i] as unknown[];
      if (!row || row.every((c) => c === null || c === undefined || c === "")) {
        skipped += 1;
        continue;
      }

      const orderRaw = String(row[0] ?? "").trim();
      const soldAt = parseSoldAt(row[2]);
      const itemsRaw = String(row[3] ?? "").trim();
      const quantity = parseNumber(row[4]) || 1;
      const netTotal = parseNumber(row[7]);
      const paymentMode = normalizePayment(String(row[8] ?? ""));

      if (!soldAt || !itemsRaw || netTotal <= 0) {
        skipped += 1;
        continue;
      }

      const orderNum = orderRaw.replace(/^#/, "") || String(i);
      const posSaleId = `csv:${soldAt.toISOString().slice(0, 10)}:${orderNum}:r${i}`;

      const gst = calculateGstFromInc(netTotal);
      const sale = await db.sale.create({
        data: {
          businessId: business.id,
          posSaleId,
          soldAt,
          totalAmount: netTotal,
          paymentMode,
          amountExGst: gst.amountExGst,
          gstAmount: gst.gstAmount,
          amountIncGst: gst.amountIncGst,
          source: "csv",
        },
      });

      const itemNames = itemsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const names = itemNames.length ? itemNames : [itemsRaw];
      const perLineQty = quantity / names.length;
      const perLineTotal = netTotal / names.length;
      const unitPrice = perLineQty > 0 ? perLineTotal / perLineQty : perLineTotal;

      for (const name of names) {
        const productId = await ensureProduct(name);
        await db.saleLine.create({
          data: {
            saleId: sale.id,
            productId,
            productName: name,
            quantity: perLineQty,
            unitPrice,
            lineTotal: perLineTotal,
          },
        });
      }

      imported += 1;
      totalRevenue += netTotal;
    }

    await recalculateProductStats(db, business.id);
    await syncGoalsFromSurplus(business.id);

    console.log(`Imported ${imported} sales (skipped ${skipped} empty/invalid rows)`);
    console.log(`Total sales revenue: $${totalRevenue.toFixed(2)}`);
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
