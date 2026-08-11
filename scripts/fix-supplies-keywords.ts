import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

/** Patterns that should map to Supplies (vendor/item name contains). */
const PATTERNS = [
  "milklab",
  "anchor",
  "strawberry",
  "biscoff",
  "anc",
  "ice",
  "coffee",
  "coconut water",
  "pork",
];

function matchesPattern(vendor: string, pattern: string): boolean {
  const v = vendor.toLowerCase();
  const p = pattern.toLowerCase();

  // "ice" is short — avoid Iceland / slice / price; match as a token
  if (p === "ice") {
    return /(?:^|[^a-z])ice(?:[^a-z]|$)/i.test(vendor);
  }

  // "anc" often appears as ANC brand prefix
  if (p === "anc") {
    return /(?:^|[^a-z])anc(?:[^a-z]|$)/i.test(vendor);
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
    const supplies = await db.category.findFirst({
      where: { businessId: business.id, slug: "supplies" },
    });
    if (!supplies) {
      console.warn(`No Supplies for ${business.name}`);
      continue;
    }

    const txs = await db.transaction.findMany({
      where: { businessId: business.id },
      select: {
        id: true,
        vendor: true,
        categoryId: true,
        category: { select: { name: true, slug: true } },
      },
    });

    const targets = txs
      .map((t) => ({ ...t, hits: matchingPatterns(t.vendor) }))
      .filter((t) => t.hits.length > 0);

    console.log(`\n${business.name}: ${targets.length} match(es)`);
    for (const t of targets) {
      const already = t.category?.slug === "supplies";
      console.log(
        `  [${already ? "ok" : "FIX"}] ${t.vendor} | ${t.category?.name ?? "—"} | hits: ${t.hits.join(", ")}`
      );
      if (!dryRun && !already) {
        await db.transaction.update({
          where: { id: t.id },
          data: { categoryId: supplies.id },
        });
      }
    }

    if (!dryRun) {
      for (const pattern of PATTERNS) {
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

      // Remove conflicting COS rules that would steal these vendors
      const conflictPatterns = ["anchor", "otis"]; // otis not in list but leave; only fix anchor if it pointed to cos
      for (const pattern of ["anchor"]) {
        const rules = await db.categorisationRule.findMany({
          where: {
            businessId: business.id,
            pattern: { equals: pattern, mode: "insensitive" },
          },
        });
        for (const rule of rules) {
          if (rule.categoryId !== supplies.id) {
            await db.categorisationRule.update({
              where: { id: rule.id },
              data: { categoryId: supplies.id },
            });
          }
        }
      }
      void conflictPatterns;
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
