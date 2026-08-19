/**
 * Wipe ALL transactions, then import costing CSV once (MM/DD dates, no dupes).
 *
 * Usage:
 *   npx tsx scripts/reimport-costing-mmdy.ts [path-to-csv]
 *   npx tsx scripts/reimport-costing-mmdy.ts --dry-run [path]
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { parseCostingCsvBuffer } from "../src/lib/excel/costing-parser";
import { calculateGstFromInc } from "../src/lib/gst/nz";
import { suggestCategory } from "../src/lib/categorisation";
import { syncGoalsFromSurplus } from "../src/lib/surplus";

const CATEGORY_SLUG_MAP: Record<string, string> = {
  Supplies: "supplies",
  "Cost of Goods Sold": "cos",
  "Non Operating": "non-operating",
  "Equipment & Tools": "equipment-tools",
};

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const fileArg = args.find((a) => !a.startsWith("--"));
  const filePath =
    fileArg ||
    path.join(
      process.env.USERPROFILE || "",
      "Downloads",
      "costing(Purchase S) (1).csv"
    );
  return { dryRun, filePath };
}

/** Store date as noon UTC so NZ calendar day stays stable. */
function dateFromKey(key: string): Date {
  return new Date(`${key}T12:00:00.000Z`);
}

async function main() {
  const { dryRun, filePath } = parseArgs();

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
      console.error("No business found");
      process.exit(1);
    }

    const buffer = fs.readFileSync(filePath);
    const { rows, errors, warnings } = parseCostingCsvBuffer(buffer);

    if (errors.length) {
      console.error("Parse errors:", errors);
      process.exit(1);
    }

    const existingAll = await db.transaction.count({
      where: { businessId: business.id },
    });
    const bySource = await db.transaction.groupBy({
      by: ["source"],
      where: { businessId: business.id },
      _count: true,
    });

    const byMonth = new Map<string, number>();
    for (const r of rows) {
      const m = r.date.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) || 0) + 1);
    }

    const summary = {
      dryRun,
      file: path.basename(filePath),
      csvRows: rows.length,
      csvWarnings: warnings.length,
      existingTransactions: existingAll,
      existingBySource: Object.fromEntries(
        bySource.map((g) => [g.source, g._count])
      ),
      byMonth: Object.fromEntries([...byMonth.entries()].sort()),
      sampleDates: rows.slice(0, 8).map((r) => ({
        date: r.date,
        purchases: r.purchases.slice(0, 40),
      })),
    };
    console.log(JSON.stringify(summary, null, 2));

    if (dryRun) {
      console.log("Dry run only — no DB changes");
      return;
    }

    // Clear bank match links that point at transactions about to be deleted
    await db.bankStatementLine.updateMany({
      where: {
        statement: { businessId: business.id },
        OR: [
          { matchedTransactionId: { not: null } },
          { appliedTransactionId: { not: null } },
        ],
      },
      data: {
        matchedTransactionId: null,
        appliedTransactionId: null,
        status: "pending",
      },
    });

    await db.asset.updateMany({
      where: { businessId: business.id, transactionId: { not: null } },
      data: { transactionId: null },
    });

    const deleted = await db.transaction.deleteMany({
      where: { businessId: business.id },
    });

    await db.importBatch.deleteMany({
      where: { businessId: business.id },
    });

    const categories = await db.category.findMany({
      where: { businessId: business.id },
    });
    const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]));
    const categoryByName = new Map(
      categories.map((c) => [c.name.toLowerCase(), c.id])
    );

    const toCreate: Array<{
      businessId: string;
      categoryId: string | null;
      date: Date;
      vendor: string;
      unitAmount: number;
      quantity: number;
      totalAmount: number;
      paymentMode: string;
      amountExGst: number;
      gstAmount: number;
      amountIncGst: number;
      gstType: string;
      type: string;
      source: string;
    }> = [];

    let totalSpend = 0;

    for (const row of rows) {
      if (!row.purchases?.trim()) continue;

      const totalAmount = row.totalAmount || row.amount * (row.quantity || 1);
      if (totalAmount === 0) continue;

      const gst = calculateGstFromInc(Math.abs(totalAmount));
      const signedGst =
        totalAmount < 0
          ? {
              amountExGst: -gst.amountExGst,
              gstAmount: -gst.gstAmount,
              amountIncGst: -gst.amountIncGst,
            }
          : gst;

      let categoryId: string | null = null;
      const slug = CATEGORY_SLUG_MAP[row.category];
      if (slug && categoryBySlug.has(slug)) {
        categoryId = categoryBySlug.get(slug)!;
      } else if (row.category) {
        categoryId = categoryByName.get(row.category.toLowerCase()) ?? null;
      }
      if (!categoryId) {
        const suggestion = await suggestCategory(business.id, row.purchases);
        if (suggestion) categoryId = suggestion.categoryId;
      }

      toCreate.push({
        businessId: business.id,
        categoryId,
        date: dateFromKey(row.date),
        vendor: row.purchases,
        unitAmount: row.amount || totalAmount,
        quantity: row.quantity || 1,
        totalAmount,
        paymentMode: row.paymentMode || "Other",
        amountExGst: signedGst.amountExGst,
        gstAmount: signedGst.gstAmount,
        amountIncGst: signedGst.amountIncGst,
        gstType: "standard_15",
        type: row.type === "refund" ? "refund" : "expense",
        source: "import",
      });
      totalSpend += totalAmount;
    }

    const BATCH = 100;
    for (let i = 0; i < toCreate.length; i += BATCH) {
      await db.transaction.createMany({ data: toCreate.slice(i, i + BATCH) });
    }

    const imported = toCreate.length;

    await db.importBatch.create({
      data: {
        businessId: business.id,
        filename: path.basename(filePath),
        rowCount: imported,
      },
    });

    await syncGoalsFromSurplus(business.id);

    const remaining = await db.transaction.count({
      where: { businessId: business.id },
    });

    console.log(
      JSON.stringify(
        {
          deleted: deleted.count,
          imported,
          remaining,
          totalSpend: Number(totalSpend.toFixed(2)),
        },
        null,
        2
      )
    );
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
