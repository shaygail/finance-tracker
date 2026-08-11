import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

/** Vendor/item substrings → Equipment & Tools */
const PATTERNS = [
  "jug",
  "measuring spoon",
  "measurring spoon",
  "whisk",
  "epson",
  "spatula",
  "jigger",
  "gazebo",
  "80mm usb",
  "usb bt",
  "milk frothing thermometer",
  "frothing thermometer",
  "non slip bar mat",
  "bar mat",
  "table cloth",
  "tablecloth",
  "orico",
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesPattern(vendor: string, pattern: string): boolean {
  const v = vendor.toLowerCase();
  const p = pattern.toLowerCase();

  // "jug" as token so we don't miss "jugs" but avoid random words
  if (p === "jug") {
    return /(?:^|[^a-z0-9])jugs?(?:[^a-z0-9]|$)/i.test(vendor);
  }

  return v.includes(p);
}

function matchingPatterns(vendor: string): string[] {
  return PATTERNS.filter((p) => matchesPattern(vendor, p));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const businesses = await db.business.findMany({ select: { id: true, name: true } });

  for (const business of businesses) {
    const equipment = await db.category.findFirst({
      where: { businessId: business.id, slug: "equipment-tools" },
    });
    if (!equipment) {
      console.warn(`No Equipment & Tools for ${business.name}`);
      continue;
    }

    const txs = await db.transaction.findMany({
      where: { businessId: business.id },
      select: {
        id: true,
        vendor: true,
        category: { select: { name: true, slug: true } },
      },
    });

    const targets = txs
      .map((t) => ({ ...t, hits: matchingPatterns(t.vendor) }))
      .filter((t) => t.hits.length > 0);

    console.log(`\n${business.name}: ${targets.length} match(es)`);
    for (const t of targets) {
      const already = t.category?.slug === "equipment-tools";
      console.log(
        `  [${already ? "ok" : "FIX"}] ${t.vendor} | ${t.category?.name ?? "—"} | hits: ${t.hits.join(", ")}`
      );
      if (!dryRun && !already) {
        await db.transaction.update({
          where: { id: t.id },
          data: { categoryId: equipment.id },
        });
      }
    }

    if (!dryRun) {
      // Prefer longer/more specific patterns first in suggestCategory by creating them;
      // also store shared matching patterns.
      const rulePatterns = [
        "milk frothing thermometer",
        "frothing thermometer",
        "non slip bar mat",
        "measuring spoon",
        "measurring spoon",
        "80mm usb",
        "usb bt",
        "table cloth",
        "tablecloth",
        "bar mat",
        "spatula",
        "jigger",
        "gazebo",
        "whisk",
        "epson",
        "orico",
        "jug",
      ];

      for (const pattern of rulePatterns) {
        const existing = await db.categorisationRule.findFirst({
          where: {
            businessId: business.id,
            pattern: { equals: pattern, mode: "insensitive" },
          },
        });
        if (existing) {
          await db.categorisationRule.update({
            where: { id: existing.id },
            data: { categoryId: equipment.id, ruleType: "vendor" },
          });
        } else {
          await db.categorisationRule.create({
            data: {
              businessId: business.id,
              pattern,
              categoryId: equipment.id,
              ruleType: "vendor",
            },
          });
        }
        console.log(`  rule "${pattern}" → Equipment & Tools`);
      }
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
