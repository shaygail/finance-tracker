import { db } from "@/lib/db";

export const SUBSCRIPTIONS_SLUG = "subscriptions";
export const SUBSCRIPTIONS_NAME = "Subscriptions";

/** Vendor / description patterns for auto-categorisation. */
const RULE_PATTERNS = [
  "cursor",
  "domain",
  "domains",
  "godaddy",
  "namecheap",
  "google domains",
  "cloudflare",
  "google workspace",
  "gsuite",
  "microsoft 365",
  "office 365",
  "email",
  "mailbox",
  "hosting",
  "railway",
  "vercel",
  "netlify",
  "github",
  "openai",
  "chatgpt",
  "anthropic",
  "claude",
  "notion",
  "canva",
  "adobe",
  "dropbox",
  "icloud",
  "apple.com/bill",
  "spotify",
  "subscription",
  "saas",
];

export async function ensureSubscriptionsCategory(
  businessId: string
): Promise<{ id: string; name: string }> {
  let category = await db.category.findUnique({
    where: {
      businessId_slug: { businessId, slug: SUBSCRIPTIONS_SLUG },
    },
  });

  if (!category) {
    category = await db.category.create({
      data: {
        businessId,
        name: SUBSCRIPTIONS_NAME,
        slug: SUBSCRIPTIONS_SLUG,
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

export async function getSubscriptionsSummary(businessId: string) {
  const category = await ensureSubscriptionsCategory(businessId);
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
      take: 50,
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
