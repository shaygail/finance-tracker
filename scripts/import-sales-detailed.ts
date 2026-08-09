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

  const m = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/
  );
  if (m) {
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    const hour = m[4] ? parseInt(m[4], 10) : 12;
    const minute = m[5] ? parseInt(m[5], 10) : 0;
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
  if (p.includes("eftpos")) return "EFTPOS";
  if (p.includes("afterpay")) return "Card/AfterPay";
  if (p.includes("card") || p.includes("visa") || p.includes("contactless")) {
    return "Credit Card";
  }
  return raw.trim() || "Other";
}

function cell(row: unknown[], i: number): string {
  const v = row[i];
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function buildLineNotes(parts: Record<string, string>): string | null {
  const bits: string[] = [];
  for (const [label, value] of Object.entries(parts)) {
    if (!value || value.toLowerCase() === "none") continue;
    bits.push(`${label}: ${value}`);
  }
  return bits.length ? bits.join(" · ") : null;
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
        unitPrice:
          (agg._sum.quantity ?? 0) > 0
            ? (agg._sum.lineTotal ?? 0) / (agg._sum.quantity ?? 1)
            : product.unitPrice,
      },
    });
  }
}

type LineRow = {
  item: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes: string | null;
};

type OrderGroup = {
  key: string;
  orderNum: string;
  customerName: string;
  soldAt: Date;
  paymentMode: string;
  netTotal: number;
  lines: LineRow[];
};

async function main() {
  const filePath =
    process.argv[2] ||
    path.join(
      process.env.USERPROFILE || "",
      "Downloads",
      "costing(Sales (new)  Sheet ).csv"
    );

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
      console.error("No business found — run npm run db:seed / db:setup-accounts first");
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

    const headers = (raw[0] as unknown[]).map((h) =>
      String(h ?? "").trim().toLowerCase()
    );
    const isDetailed =
      headers.includes("item") && headers.includes("unit price (nzd)");

    if (!isDetailed) {
      console.error(
        "Expected detailed sales CSV with Item / Unit Price columns"
      );
      process.exit(1);
    }

    // Column map for detailed sheet
    const col = {
      order: 0,
      name: 1,
      date: 2,
      item: 3,
      qty: 4,
      unitPrice: 5,
      lineTotal: 6,
      size: 7,
      milk: 8,
      sweetness: 9,
      ice: 10,
      temperature: 11,
      strength: 12,
      syrup: 13,
      foam: 14,
      espresso: 15,
      extraAddOns: 16,
      addOnsSummary: 17,
      note: 18,
      otherModifiers: 19,
      subtotal: 20,
      discount: 21,
      netTotal: 22,
      payment: 23,
    };

    const groups = new Map<string, OrderGroup>();
    let skipped = 0;

    for (let i = 1; i < raw.length; i++) {
      const row = raw[i] as unknown[];
      if (!row || row.every((c) => c === null || c === undefined || c === "")) {
        skipped += 1;
        continue;
      }

      const item = cell(row, col.item);
      if (!item || item.toUpperCase() === "TOTAL") {
        skipped += 1;
        continue;
      }

      const soldAt = parseSoldAt(row[col.date]);
      const quantity = parseNumber(row[col.qty]) || 1;
      const unitPrice = parseNumber(row[col.unitPrice]);
      const lineTotal =
        parseNumber(row[col.lineTotal]) || unitPrice * quantity;
      const netTotal = parseNumber(row[col.netTotal]) || lineTotal;
      const orderNum = cell(row, col.order).replace(/^#/, "") || String(i);
      const customerName = cell(row, col.name);
      const paymentMode = normalizePayment(cell(row, col.payment));

      if (!soldAt || lineTotal <= 0) {
        skipped += 1;
        continue;
      }

      const notes = buildLineNotes({
        Size: cell(row, col.size),
        Milk: cell(row, col.milk),
        Sweetness: cell(row, col.sweetness),
        Ice: cell(row, col.ice),
        Temperature: cell(row, col.temperature),
        Strength: cell(row, col.strength),
        Syrup: cell(row, col.syrup),
        Foam: cell(row, col.foam),
        Espresso: cell(row, col.espresso),
        "Extra add-ons": cell(row, col.extraAddOns),
        "Add-ons": cell(row, col.addOnsSummary),
        Note: cell(row, col.note),
        Other: cell(row, col.otherModifiers),
      });

      const dateKey = soldAt.toISOString();
      const key = `${dateKey}|${orderNum}|${customerName}|${paymentMode}`;

      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          orderNum,
          customerName,
          soldAt,
          paymentMode,
          netTotal,
          lines: [],
        };
        groups.set(key, group);
      } else if (netTotal > 0) {
        group.netTotal = netTotal;
      }

      group.lines.push({
        item,
        quantity,
        unitPrice: unitPrice || lineTotal / quantity,
        lineTotal,
        notes,
      });
    }

    const productCache = new Map<string, string>();
    async function ensureProduct(name: string, unitPrice: number) {
      const key = name.trim().toLowerCase();
      if (productCache.has(key)) return productCache.get(key)!;
      const existing = await db.product.findFirst({
        where: {
          businessId: business!.id,
          name: { equals: name.trim(), mode: "insensitive" },
        },
      });
      if (existing) {
        productCache.set(key, existing.id);
        return existing.id;
      }
      const created = await db.product.create({
        data: {
          businessId: business!.id,
          name: name.trim(),
          unitPrice,
          unitsSold: 0,
          revenue: 0,
        },
      });
      productCache.set(key, created.id);
      return created.id;
    }

    let imported = 0;
    let lineCount = 0;
    let totalRevenue = 0;

    for (const group of groups.values()) {
      const lineSum = group.lines.reduce((s, l) => s + l.lineTotal, 0);
      const orderTotal = group.netTotal > 0 ? group.netTotal : lineSum;
      const posSaleId = `csv-detail:${group.soldAt.toISOString()}:${group.orderNum}:${group.customerName || "guest"}`;

      const existing = await db.sale.findUnique({
        where: {
          businessId_posSaleId: {
            businessId: business.id,
            posSaleId,
          },
        },
      });
      if (existing) {
        await db.saleLine.deleteMany({ where: { saleId: existing.id } });
        await db.sale.delete({ where: { id: existing.id } });
      }

      const gst = calculateGstFromInc(orderTotal);
      const sale = await db.sale.create({
        data: {
          businessId: business.id,
          posSaleId,
          soldAt: group.soldAt,
          customerName: group.customerName || null,
          totalAmount: orderTotal,
          paymentMode: group.paymentMode,
          amountExGst: gst.amountExGst,
          gstAmount: gst.gstAmount,
          amountIncGst: gst.amountIncGst,
          source: "csv",
        },
      });

      for (const line of group.lines) {
        const productId = await ensureProduct(line.item, line.unitPrice);
        await db.saleLine.create({
          data: {
            saleId: sale.id,
            productId,
            productName: line.item,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
            notes: line.notes,
          },
        });
        lineCount += 1;
      }

      imported += 1;
      totalRevenue += orderTotal;
    }

    await recalculateProductStats(db, business.id);
    await syncGoalsFromSurplus(business.id);

    console.log(`Imported ${imported} orders / ${lineCount} line items`);
    console.log(`Skipped ${skipped} empty/total rows`);
    console.log(`Total sales revenue (this file): $${totalRevenue.toFixed(2)}`);
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
