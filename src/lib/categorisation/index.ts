import { db } from "@/lib/db";

export async function suggestCategory(
  businessId: string,
  vendor: string
): Promise<{ categoryId: string; categoryName: string } | null> {
  const rules = await db.categorisationRule.findMany({
    where: { businessId },
  });

  const normalizedVendor = vendor.toLowerCase().trim();

  for (const rule of rules) {
    const pattern = rule.pattern.toLowerCase();
    if (normalizedVendor.includes(pattern) || pattern.includes(normalizedVendor)) {
      const category = await db.category.findUnique({
        where: { id: rule.categoryId },
      });
      if (category) {
        return { categoryId: category.id, categoryName: category.name };
      }
    }
  }

  return null;
}

export function suggestCategoryFromRules(
  vendor: string,
  rules: Array<{ pattern: string; categoryId: string; categoryName: string }>
): { categoryId: string; categoryName: string } | null {
  const normalizedVendor = vendor.toLowerCase().trim();

  for (const rule of rules) {
    const pattern = rule.pattern.toLowerCase();
    if (normalizedVendor.includes(pattern) || pattern.includes(normalizedVendor)) {
      return { categoryId: rule.categoryId, categoryName: rule.categoryName };
    }
  }

  return null;
}
