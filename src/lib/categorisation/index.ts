import { db } from "@/lib/db";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Short patterns (e.g. anc, ice) match as whole tokens to avoid Iceland / finance. */
function patternMatches(vendor: string, pattern: string): boolean {
  const normalizedVendor = vendor.toLowerCase().trim();
  const normalizedPattern = pattern.toLowerCase().trim();
  if (!normalizedPattern) return false;

  // "jug" / "jugs" as whole tokens
  if (normalizedPattern === "jug" || normalizedPattern === "jugs") {
    return /(?:^|[^a-z0-9])jugs?(?:[^a-z0-9]|$)/i.test(vendor);
  }

  if (normalizedPattern.length <= 3) {
    const re = new RegExp(
      `(?:^|[^a-z0-9])${escapeRegex(normalizedPattern)}(?:[^a-z0-9]|$)`,
      "i"
    );
    return re.test(vendor);
  }

  return (
    normalizedVendor.includes(normalizedPattern) ||
    normalizedPattern.includes(normalizedVendor)
  );
}

export async function suggestCategory(
  businessId: string,
  vendor: string
): Promise<{ categoryId: string; categoryName: string } | null> {
  const rules = await db.categorisationRule.findMany({
    where: { businessId },
  });

  for (const rule of rules) {
    if (!patternMatches(vendor, rule.pattern)) continue;
    const category = await db.category.findUnique({
      where: { id: rule.categoryId },
    });
    if (category) {
      return { categoryId: category.id, categoryName: category.name };
    }
  }

  return null;
}

export function suggestCategoryFromRules(
  vendor: string,
  rules: Array<{ pattern: string; categoryId: string; categoryName: string }>
): { categoryId: string; categoryName: string } | null {
  for (const rule of rules) {
    if (!patternMatches(vendor, rule.pattern)) continue;
    return { categoryId: rule.categoryId, categoryName: rule.categoryName };
  }

  return null;
}
