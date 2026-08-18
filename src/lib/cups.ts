/**
 * Cup sales = drink units from POS sale lines.
 * Excludes siomai packs, individual/carton milks, sizes-only lines, and non-drink noise.
 *
 * Size history:
 * - ~Mar 2026: size often sold as separate "Venti" / "Grande" lines
 *   (Venti = Large, Grande = Regular)
 * - From ~8 May 2026: size usually lives in item notes (`Size: Large|Regular`)
 */

import { db } from "@/lib/db";

export type DrinkSize = "regular" | "large" | "other";

export interface CupsSummary {
  cups: number;
  revenue: number;
  bySize: Array<{
    size: DrinkSize;
    label: string;
    cups: number;
    revenue: number;
  }>;
  topLines: Array<{
    productName: string;
    cups: number;
    revenue: number;
  }>;
}

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

/** Standalone POS size lines used before notes carried Size. */
export function sizeFromModifierName(productName: string): DrinkSize | null {
  const n = productName.trim().toLowerCase();
  if (n === "venti") return "large";
  if (n === "grande") return "regular";
  return null;
}

function sizeLabel(size: DrinkSize): string {
  if (size === "large") return "Large";
  if (size === "regular") return "Regular";
  return "Unspecified size";
}

/**
 * Prefer Size from POS customisation notes; then name hints;
 * optional sibling size from older Venti/Grande modifier lines.
 */
export function classifyDrinkSize(
  productName: string,
  notes?: string | null,
  siblingSize?: DrinkSize | null
): { size: DrinkSize; label: string } {
  const fromNotes = notes?.match(/\bSize:\s*(Large|Regular|Venti|Grande)\b/i);
  if (fromNotes) {
    const raw = fromNotes[1].toLowerCase();
    if (raw === "large" || raw === "venti") {
      return { size: "large", label: "Large" };
    }
    if (raw === "regular" || raw === "grande") {
      return { size: "regular", label: "Regular" };
    }
  }

  const n = productName.toLowerCase();
  if (/\blarge\b/.test(n) || /\bventi\b/.test(n)) {
    return { size: "large", label: "Large" };
  }
  if (/\bregular\b/.test(n) || /\bgrande\b/.test(n) || /\btall\b/.test(n)) {
    return { size: "regular", label: "Regular" };
  }

  if (siblingSize === "large" || siblingSize === "regular") {
    return { size: siblingSize, label: sizeLabel(siblingSize) };
  }

  return { size: "other", label: sizeLabel("other") };
}

/** Infer order-level size when older POS added Venti/Grande as separate lines. */
export function siblingSizeFromSaleLines(
  lines: Array<{ productName: string }>
): DrinkSize | null {
  let large = 0;
  let regular = 0;
  for (const line of lines) {
    const size = sizeFromModifierName(line.productName);
    if (size === "large") large += 1;
    if (size === "regular") regular += 1;
  }
  if (large > 0 && regular === 0) return "large";
  if (regular > 0 && large === 0) return "regular";
  // Mixed sizes on one order — don't guess for the whole order
  return null;
}

export function summariseCupsLines(
  lines: Array<{
    productName: string;
    quantity: number;
    lineTotal: number;
    sku?: string | null;
    notes?: string | null;
    siblingSize?: DrinkSize | null;
  }>
): CupsSummary {
  const sizeMap = new Map<
    DrinkSize,
    { label: string; cups: number; revenue: number }
  >();
  const nameMap = new Map<string, { cups: number; revenue: number }>();

  let cups = 0;
  let revenue = 0;

  for (const line of lines) {
    if (!isCupSaleItem(line.productName, line.sku)) continue;
    const qty = Number(line.quantity) || 0;
    const total = Number(line.lineTotal) || 0;
    const { size, label } = classifyDrinkSize(
      line.productName,
      line.notes,
      line.siblingSize
    );

    cups += qty;
    revenue += total;

    const cur = sizeMap.get(size) ?? { label, cups: 0, revenue: 0 };
    cur.cups += qty;
    cur.revenue += total;
    sizeMap.set(size, cur);

    const byName = nameMap.get(line.productName) ?? { cups: 0, revenue: 0 };
    byName.cups += qty;
    byName.revenue += total;
    nameMap.set(line.productName, byName);
  }

  const order: DrinkSize[] = ["regular", "large", "other"];
  const bySize = order
    .filter((s) => sizeMap.has(s))
    .map((s) => {
      const row = sizeMap.get(s)!;
      return {
        size: s,
        label: row.label,
        cups: Math.round(row.cups * 100) / 100,
        revenue: Math.round(row.revenue * 100) / 100,
      };
    });

  const topLines = Array.from(nameMap.entries())
    .map(([productName, v]) => ({
      productName,
      cups: Math.round(v.cups * 100) / 100,
      revenue: Math.round(v.revenue * 100) / 100,
    }))
    .sort((a, b) => b.cups - a.cups)
    .slice(0, 8);

  return {
    cups: Math.round(cups * 100) / 100,
    revenue: Math.round(revenue * 100) / 100,
    bySize,
    topLines,
  };
}

export function sumCupsSold(
  lines: Array<{ productName: string; quantity: number; sku?: string | null }>
): number {
  return summariseCupsLines(
    lines.map((l) => ({ ...l, lineTotal: 0, notes: null }))
  ).cups;
}

/** Drink cups sold summary (all-time from synced POS sale lines). */
export async function getCupsSold(businessId: string): Promise<CupsSummary> {
  const lines = await db.saleLine.findMany({
    where: { sale: { businessId } },
    select: {
      saleId: true,
      productName: true,
      quantity: true,
      lineTotal: true,
      notes: true,
      product: { select: { sku: true } },
    },
  });

  const bySale = new Map<string, typeof lines>();
  for (const line of lines) {
    const list = bySale.get(line.saleId) ?? [];
    list.push(line);
    bySale.set(line.saleId, list);
  }

  const siblingBySale = new Map<string, DrinkSize | null>();
  for (const [saleId, saleLines] of bySale) {
    siblingBySale.set(saleId, siblingSizeFromSaleLines(saleLines));
  }

  return summariseCupsLines(
    lines.map((l) => ({
      productName: l.productName,
      quantity: l.quantity,
      lineTotal: l.lineTotal,
      notes: l.notes,
      sku: l.product?.sku ?? null,
      siblingSize: siblingBySale.get(l.saleId) ?? null,
    }))
  );
}
