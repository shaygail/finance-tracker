import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { parseSpreadsheetBuffer } from "../src/lib/excel/parser";
import { calculateGstFromInc } from "../src/lib/gst/nz";
import { suggestCategory } from "../src/lib/categorisation";
import { syncGoalsFromSurplus } from "../src/lib/surplus";

const CATEGORY_SLUG_MAP: Record<string, string> = {
  Supplies: "supplies",
  "Cost of Goods Sold": "cos",
  "Non Operating": "non-operating",
  "Equipment & Tools": "equipment-tools",
};

async function main() {
  const filePath =
    process.argv[2] ||
    path.join(
      process.env.USERPROFILE || "",
      "Downloads",
      "costing(Purchase S).csv"
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
    const business = await db.business.findFirst({ orderBy: { createdAt: "asc" } });
    if (!business) {
      console.error("No business found — run npm run db:seed first");
      process.exit(1);
    }

    const buffer = fs.readFileSync(filePath);
    const { rows, errors, warnings } = parseSpreadsheetBuffer(
      buffer,
      path.basename(filePath)
    );

    if (errors.length) {
      console.error("Parse errors:", errors);
      process.exit(1);
    }

    console.log(`Parsed ${rows.length} rows (${warnings?.length ?? 0} warnings)`);

    // Replace previous imports of this file so re-runs stay clean
    await db.transaction.deleteMany({
      where: { businessId: business.id, source: "import" },
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

    let imported = 0;
    let totalSpend = 0;

    for (const row of rows) {
      if (!row.purchases?.trim()) continue;

      const totalAmount = row.totalAmount || row.amount * (row.quantity || 1);
      if (totalAmount <= 0) continue;

      const gst = calculateGstFromInc(totalAmount);
      let categoryId: string | null = null;

      const slug = CATEGORY_SLUG_MAP[row.category];
      if (slug && categoryBySlug.has(slug)) {
        categoryId = categoryBySlug.get(slug)!;
      } else if (row.category) {
        categoryId =
          categoryByName.get(row.category.toLowerCase()) ?? null;
      }
      if (!categoryId) {
        const suggestion = await suggestCategory(business.id, row.purchases);
        if (suggestion) categoryId = suggestion.categoryId;
      }

      await db.transaction.create({
        data: {
          businessId: business.id,
          categoryId,
          date: new Date(row.date),
          vendor: row.purchases,
          unitAmount: row.amount || totalAmount,
          quantity: row.quantity || 1,
          totalAmount,
          paymentMode: row.paymentMode || "Other",
          amountExGst: gst.amountExGst,
          gstAmount: gst.gstAmount,
          amountIncGst: gst.amountIncGst,
          gstType: "standard_15",
          type: row.type === "refund" ? "refund" : "expense",
          source: "import",
        },
      });

      imported += 1;
      totalSpend += totalAmount;
    }

    await db.importBatch.create({
      data: {
        businessId: business.id,
        filename: path.basename(filePath),
        rowCount: imported,
      },
    });

    await syncGoalsFromSurplus(business.id);

    const byCategory = await db.transaction.groupBy({
      by: ["categoryId"],
      where: { businessId: business.id, source: "import", type: "expense" },
      _sum: { totalAmount: true },
    });

    console.log(`Imported ${imported} purchase rows`);
    console.log(`Total expenses: $${totalSpend.toFixed(2)}`);
    console.log("By categoryId sums:", byCategory.length, "groups");
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
