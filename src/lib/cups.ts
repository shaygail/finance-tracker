/**
 * Cup sales = drink units from POS sale lines.
 * Excludes siomai packs, individual/carton milks, sizes-only lines, and non-drink noise.
 */

import { db } from "@/lib/db";

const EXCLUDE_PATTERNS: RegExp[] = [
  /\bsiomai\b/i,
  /\bpork\s*shrimp\b/i,
  /\b12\s*pcs?\b/i,
  /\b6\s*pcs?\b/i,
  /\b5\s*pcs?\b/i,
  /\(1\s*tub\)/i,
  /\boat\s*milk\b/i,
  /\balmond\s*milk\b/i,
  /\bsoy\s*milk\b/i,
  /\bmacadamia\b/i,
  /\bmilks?\s*\(carton\)/i,
  /^\s*(oat|almond|soy|macadamia)(\s*\(1l\))?\s*$/i,
  /\(1l\)\s*$/i,
  /^\s*venti\s*$/i,
  /^\s*grande\s*$/i,
  /\bdelivery\b/i,
  /\bfee\b/i,
  /\btray\b/i,
  /\bdiscount\b/i,
  /\bpaywave\b/i,
  /\beftpos\b/i,
  /\bvisa\b/i,
  /\bchilli\s*oil\b/i,
  /\bsyrup\b/i,
  /\bgraham\b/i,
  /\bsip\s*&\s*bite\b/i,
  /\b1\.5l\b/i,
];

export function isCupSaleItem(productName: string, sku?: string | null): boolean {
  const name = productName.trim();
  if (!name) return false;

  const haystack = `${name} ${sku ?? ""}`;
  for (const re of EXCLUDE_PATTERNS) {
    if (re.test(haystack) || re.test(name)) return false;
  }
  return true;
}

export function sumCupsSold(
  lines: Array<{ productName: string; quantity: number; sku?: string | null }>
): number {
  const total = lines.reduce((sum, line) => {
    if (!isCupSaleItem(line.productName, line.sku)) return sum;
    return sum + (Number(line.quantity) || 0);
  }, 0);
  return Math.round(total * 100) / 100;
}

/** Total drink cups sold (all-time from synced POS sale lines). */
export async function getCupsSold(businessId: string): Promise<number> {
  const lines = await db.saleLine.findMany({
    where: { sale: { businessId } },
    select: {
      productName: true,
      quantity: true,
      product: { select: { sku: true } },
    },
  });

  return sumCupsSold(
    lines.map((l) => ({
      productName: l.productName,
      quantity: l.quantity,
      sku: l.product?.sku ?? null,
    }))
  );
}
