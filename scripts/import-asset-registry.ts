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
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0)
  );
}

function isSameAssetRow(
  existing: {
    name: string;
    model: string | null;
    datePurchased: Date;
    unitCost: number;
    quantity: number;
  },
  row: {
    name: string;
    model: string | null;
    datePurchased: Date;
    unitCost: number;
    quantity: number;
  }
): boolean {
  return (
    normalizeAssetKey(existing.name) === normalizeAssetKey(row.name) &&
    normalizeAssetKey(existing.model ?? "") === normalizeAssetKey(row.model ?? "") &&
    sameCalendarDay(existing.datePurchased, row.datePurchased) &&
    moneyClose(existing.unitCost, row.unitCost) &&
    Math.abs(existing.quantity - row.quantity) < 0.01
  );
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

    // Rebuild register from CSV so date fixes and repeat purchases apply cleanly
    await db.asset.deleteMany({ where: { businessId: business.id } });

    const buffer = fs.readFileSync(filePath);
    const parsed = parseAssetRegistryBuffer(buffer);

    const existingAssets: Array<{
      name: string;
      model: string | null;
      datePurchased: Date;
      unitCost: number;
      quantity: number;
    }> = [];

    let imported = 0;
    let skipped = 0;

    for (const row of parsed.rows) {
      const purchased = dayStart(row.datePurchased);
      const dup = existingAssets.some((a) =>
        isSameAssetRow(a, {
          name: row.name,
          model: row.model,
          datePurchased: row.datePurchased,
          unitCost: row.unitCost,
          quantity: row.quantity,
        })
      );
      if (dup) {
        skipped += 1;
        continue;
      }

      await db.asset.create({
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
      existingAssets.push({
        name: row.name,
        model: row.model,
        datePurchased: purchased,
        unitCost: row.unitCost,
        quantity: row.quantity,
      });
      imported += 1;
    }

    const stands = existingAssets.filter((a) =>
      normalizeAssetKey(a.name).includes("display stand")
    );
    const squeezes = existingAssets.filter((a) =>
      normalizeAssetKey(a.name).includes("squeeze")
    );

    console.log(`Imported ${imported} assets, skipped ${skipped} exact in-file duplicates`);
    console.log(
      "Display Stands:",
      stands.map((s) => ({
        qty: s.quantity,
        date: s.datePurchased.toISOString().slice(0, 10),
        unit: s.unitCost,
      }))
    );
    console.log(`Squeeze Bottle rows: ${squeezes.length}`);
    console.log(`Total assets: ${existingAssets.length}`);
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
