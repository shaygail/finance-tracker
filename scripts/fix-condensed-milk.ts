import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const CANONICAL_NAME = "Highlander condensed milk";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

function isCondensedMilkVendor(vendor: string): boolean {
  const v = vendor.toLowerCase();
  return (
    v.includes("condensed") ||
    (v.includes("highlander") && (v.includes("cond") || v.includes("milk")))
  );
}

async function main() {
  const businesses = await db.business.findMany({ select: { id: true, name: true } });

  for (const business of businesses) {
    const supplies = await db.category.findFirst({
      where: { businessId: business.id, slug: "supplies" },
    });
    if (!supplies) {
      console.warn(`No Supplies category for ${business.name} — skip`);
      continue;
    }

    const txs = await db.transaction.findMany({
      where: { businessId: business.id },
      select: { id: true, vendor: true, categoryId: true },
    });

    const targets = txs.filter((t) => isCondensedMilkVendor(t.vendor));
    console.log(`${business.name}: ${targets.length} condensed milk transaction(s)`);

    for (const t of targets) {
      await db.transaction.update({
        where: { id: t.id },
        data: {
          vendor: CANONICAL_NAME,
          categoryId: supplies.id,
        },
      });
      console.log(`  ${t.vendor} → ${CANONICAL_NAME} / Supplies`);
    }

    const ingredients = await db.ingredient.findMany({
      where: {
        businessId: business.id,
        OR: [
          { name: { contains: "condensed", mode: "insensitive" } },
          { name: { contains: "highlander", mode: "insensitive" } },
        ],
      },
    });
    for (const ing of ingredients) {
      if (ing.name === CANONICAL_NAME) continue;
      await db.ingredient.update({
        where: { id: ing.id },
        data: { name: CANONICAL_NAME },
      });
      console.log(`  ingredient ${ing.name} → ${CANONICAL_NAME}`);
    }

    // Ensure auto-categorisation for future imports
    const patterns = ["highlander condensed", "condensed milk", "jersey condensed"];
    for (const pattern of patterns) {
      const existing = await db.categorisationRule.findFirst({
        where: {
          businessId: business.id,
          pattern: { equals: pattern, mode: "insensitive" },
        },
      });
      if (existing) {
        await db.categorisationRule.update({
          where: { id: existing.id },
          data: { categoryId: supplies.id, ruleType: "vendor" },
        });
      } else {
        await db.categorisationRule.create({
          data: {
            businessId: business.id,
            pattern,
            categoryId: supplies.id,
            ruleType: "vendor",
          },
        });
      }
      console.log(`  rule "${pattern}" → Supplies`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
