import { db } from "@/lib/db";

export const RENTAL_MARKET_SLUG = "rental-market-fees";
export const RENTAL_MARKET_NAME = "Rental / Market fees";

const RULE_PATTERNS = [
  "stall fee",
  "stall",
  "market fee",
  "market hire",
  "rental",
  "rent ",
  "site fee",
  "pitch fee",
  "table hire",
];

/** Ensure the Rental / Market fees category + vendor rules exist for a business. */
export async function ensureRentalMarketFeesCategory(
  businessId: string
): Promise<{ id: string; name: string }> {
  let category = await db.category.findUnique({
    where: {
      businessId_slug: { businessId, slug: RENTAL_MARKET_SLUG },
    },
  });

  if (!category) {
    category = await db.category.create({
      data: {
        businessId,
        name: RENTAL_MARKET_NAME,
        slug: RENTAL_MARKET_SLUG,
        type: "expense",
      },
    });
  }

  const existing = await db.categorisationRule.findMany({
    where: { businessId, categoryId: category.id },
    select: { pattern: true },
  });
  const have = new Set(existing.map((r) => r.pattern.toLowerCase()));

  for (const pattern of RULE_PATTERNS) {
    if (have.has(pattern.toLowerCase())) continue;
    await db.categorisationRule.create({
      data: {
        businessId,
        categoryId: category.id,
        pattern,
        ruleType: "vendor",
      },
    });
  }

  return { id: category.id, name: category.name };
}

export async function getRentalMarketFeesSummary(businessId: string) {
  const category = await ensureRentalMarketFeesCategory(businessId);
  const [agg, recent] = await Promise.all([
    db.transaction.aggregate({
      where: {
        businessId,
        categoryId: category.id,
        type: { in: ["expense", "refund"] },
      },
      _sum: { totalAmount: true },
      _count: true,
    }),
    db.transaction.findMany({
      where: {
        businessId,
        categoryId: category.id,
        type: { in: ["expense", "refund"] },
      },
      orderBy: { date: "desc" },
      take: 40,
    }),
  ]);

  return {
    categoryId: category.id,
    categoryName: category.name,
    total: agg._sum.totalAmount ?? 0,
    count: agg._count,
    recent,
  };
}
