import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  moneyClose,
  normalizeAssetKey,
  parseAssetRegistryBuffer,
  sameCalendarDay,
} from "../src/lib/excel/asset-registry-parser";

function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

async function main() {
  const filePath =
    process.argv[2] ||
    path.join(
      process.env.USERPROFILE || "",
      "Downloads",
      "costing(Asset Registry).csv"
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
      console.error("No business found");
      process.exit(1);
    }

    const buffer = fs.readFileSync(filePath);
    const parsed = parseAssetRegistryBuffer(buffer);
    console.log(`Parsed ${parsed.rows.length} asset rows (${parsed.skipped} empty skipped)`);
    if (parsed.errors.length) {
      console.log("Warnings:");
      for (const e of parsed.errors) console.log(" -", e);
    }

    const existingAssets = await db.asset.findMany({
      where: { businessId: business.id },
    });
    const purchases = await db.transaction.findMany({
      where: { businessId: business.id, type: { in: ["expense", "refund"] } },
    });

    let imported = 0;
    let skipped = 0;

    for (const row of parsed.rows) {
      const key = normalizeAssetKey(row.name);
      const purchased = dayStart(row.datePurchased);

      const dupAsset = existingAssets.some(
        (a) =>
          normalizeAssetKey(a.name) === key &&
          sameCalendarDay(a.datePurchased, row.datePurchased) &&
          moneyClose(a.unitCost, row.unitCost) &&
          Math.abs(a.quantity - row.quantity) < 0.01
      );
      if (dupAsset) {
        skipped += 1;
        continue;
      }

      const dupPurchase = purchases.some((t) => {
        if (!sameCalendarDay(t.date, row.datePurchased)) return false;
        const vendorKey = normalizeAssetKey(t.vendor);
        const nameMatch =
          vendorKey === key || vendorKey.includes(key) || key.includes(vendorKey);
        if (!nameMatch) return false;
        return (
          moneyClose(t.unitAmount, row.unitCost) ||
          moneyClose(t.totalAmount, row.totalCost) ||
          moneyClose(t.totalAmount, row.unitCost)
        );
      });
      if (dupPurchase) {
        skipped += 1;
        continue;
      }

      const created = await db.asset.create({
        data: {
          businessId: business.id,
          name: row.name,
          description: row.description,
          location: row.location,
          model: row.model,
          brand: row.brand,
          quantity: row.quantity,
          datePurchased: purchased,
          unitCost: row.unitCost,
          totalCost: row.totalCost,
          source: "csv",
        },
      });
      existingAssets.push(created);
      imported += 1;
    }

    console.log(`Imported ${imported} assets, skipped ${skipped} duplicates`);
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
