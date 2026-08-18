/**
 * Cup sales = drink units from POS sale lines.
 * Excludes siomai packs, individual/carton milks, sizes-only lines, and non-drink noise.
 *
 * Size history:
 * - 26 Feb–6 Mar 2026: early orders had no size recorded — all Regular
 * - ~Mar 2026: size often sold as separate "Venti" / "Grande" lines
 *   (Venti = Large, Grande = Regular)
 * - Pre-notes pricing: Regular ≈ $8 or $8.50; Strawberry Matcha Regular = $10
 * - From ~8 May 2026: size usually lives in item notes (`Size: Large|Regular`)
 */

import { db } from "@/lib/db";
import { canonicalizeProductName } from "@/lib/pos/product-aliases";
import priceBookData from "@/lib/cups-price-book.json";

type PriceBookFile = {
  book: Record<string, Record<string, "small" | "regular" | "large">>;
};

export type DrinkSize = "small" | "regular" | "large" | "other";

type MappedSize = "small" | "regular" | "large";

const PRICE_BOOK = (priceBookData as PriceBookFile).book;

/** Owner-confirmed price → size (wins over generated CSV book). */
const OWNER_PRICE_OVERRIDES: Record<string, Record<string, MappedSize>> = {
  "ube cream matcha": {
    "10": "large",
    "11": "large",
    "11.5": "large",
    "20": "large",
    "22": "large",
  },
  "twilight coconut cloud": { "10": "large" },
  "twilight cloud": { "10": "large" },
  "ube cream cold brew": { "10": "large" },
  "ube cream coldbrew latte": { "10": "large" },
  "earl grey matcha": { "9": "regular", "10": "large" },
  "black pearl cloud": { "10": "large", "11": "large" },
  "black pearl coconut cloud": { "10": "large", "11": "large" },
  "iced chocolate": { "6": "regular" },
  "matcha latte": { "7.5": "regular", "7": "regular" },
  "flavoured latte": { "6.5": "regular" },
  americano: { "5.5": "small", "6.5": "regular" },
  "strawberry cloud matcha": { "11": "regular" },
  "twilight cream": { "9.5": "regular" },
  mocha: { "10": "large" },
  "biscoff latte": { "10": "regular" },
  "midnight cream": { "12": "large" },
  "spanish latte cold brew": { "7": "regular", "8": "regular" },
  "cold brew": { "6": "regular", "7": "regular", "8": "regular" },
  "classic matcha": { "7": "regular", "9": "large" },
  "og matcha latte": { "7": "regular", "9": "large" },
  "ube spanish latte": { "9": "regular", "12": "large" },
};

function normDrinkKey(name: string): string {
  return canonicalizeProductName(name).trim().toLowerCase().replace(/\s+/g, " ");
}

function rawDrinkKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function hasAltMilkAddOn(notes?: string | null): boolean {
  if (!notes) return false;
  return (
    /\b(almond|oat|soy|macadamia|coconut)\s*milk\b/i.test(notes) ||
    /\bMilk:\s*(Almond|Oat|Soy|Macadamia|Coconut)\b/i.test(notes)
  );
}

function isMappedSize(value: unknown): value is MappedSize {
  return value === "small" || value === "regular" || value === "large";
}

function lookupPriceSize(
  key: string,
  priceKey: string
): DrinkSize | null {
  const fromOwner = OWNER_PRICE_OVERRIDES[key]?.[priceKey];
  if (isMappedSize(fromOwner)) return fromOwner;
  const fromBook = PRICE_BOOK[key]?.[priceKey];
  if (isMappedSize(fromBook)) return fromBook;
  return null;
}

function sizeFromPriceBook(
  productName: string,
  unitPrice: number,
  notes?: string | null
): DrinkSize | null {
  const priceKey = String(Math.round(unitPrice * 100) / 100);
  const raw = rawDrinkKey(productName);
  const canonical = normDrinkKey(productName);
  const isMatchaLatte = raw === "matcha latte" || canonical === "matcha latte";

  // Classic Matcha uses OG Matcha Latte size prices ($7 Regular / $9 Large)
  if (raw === "classic matcha" || canonical === "classic matcha") {
    return (
      lookupPriceSize("classic matcha", priceKey) ??
      lookupPriceSize("og matcha latte", priceKey)
    );
  }

  // Matcha Latte: base $7 / $7.50 = Regular; alt-milk / other prices → OG Matcha Latte book
  if (isMatchaLatte) {
    const base = lookupPriceSize("matcha latte", priceKey);
    if (base) return base;
    if (hasAltMilkAddOn(notes) || (unitPrice > 7.6 && unitPrice < 20)) {
      const og = lookupPriceSize("og matcha latte", priceKey);
      if (og) return og;
    }
  }

  return (
    lookupPriceSize(canonical, priceKey) ??
    lookupPriceSize(raw, priceKey)
  );
}
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
  if (size === "small") return "Small";
  if (size === "large") return "Large";
  if (size === "regular") return "Regular";
  return "Unspecified size";
}

/** Early POS window with no size field — owner confirmed all Regular. */
export function isEarlyRegularSizeWindow(soldAt?: Date | null): boolean {
  if (!soldAt || Number.isNaN(soldAt.getTime())) return false;
  const day = soldAt.toISOString().slice(0, 10);
  return day >= "2026-02-26" && day <= "2026-03-06";
}

/**
 * Prefer Size from POS customisation notes; then name hints;
 * optional sibling size from older Venti/Grande modifier lines;
 * early-window default Regular (26 Feb–6 Mar 2026);
 * then CSV price book (product + unit price → size);
 * then historical unit prices ($8 / $8.50 Regular; Strawberry Matcha $10 Regular).
 */
export function classifyDrinkSize(
  productName: string,
  notes?: string | null,
  siblingSize?: DrinkSize | null,
  soldAt?: Date | null,
  unitPrice?: number | null
): { size: DrinkSize; label: string } {
  const fromNotes = notes?.match(/\bSize:\s*(Small|Large|Regular|Venti|Grande)\b/i);
  if (fromNotes) {
    const raw = fromNotes[1].toLowerCase();
    if (raw === "small") {
      return { size: "small", label: "Small" };
    }
    if (raw === "large" || raw === "venti") {
      return { size: "large", label: "Large" };
    }
    if (raw === "regular" || raw === "grande") {
      return { size: "regular", label: "Regular" };
    }
  }

  const n = productName.toLowerCase();
  if (/\bsmall\b/.test(n)) {
    return { size: "small", label: "Small" };
  }
  if (/\blarge\b/.test(n) || /\bventi\b/.test(n)) {
    return { size: "large", label: "Large" };
  }
  if (/\bregular\b/.test(n) || /\bgrande\b/.test(n) || /\btall\b/.test(n)) {
    return { size: "regular", label: "Regular" };
  }

  if (siblingSize === "large" || siblingSize === "regular") {
    return { size: siblingSize, label: sizeLabel(siblingSize) };
  }

  if (isEarlyRegularSizeWindow(soldAt)) {
    return { size: "regular", label: "Regular" };
  }

  const price = Number(unitPrice);
  if (Number.isFinite(price) && price > 0) {
    const rounded = Math.round(price * 100) / 100;
    const fromBook = sizeFromPriceBook(productName, rounded, notes);
    if (fromBook) {
      return { size: fromBook, label: sizeLabel(fromBook) };
    }

    const isStrawberryMatcha = /\bstrawberry\s*matcha\b/i.test(productName);
    if (isStrawberryMatcha && almostEqual(rounded, 10)) {
      return { size: "regular", label: "Regular" };
    }
    // Historical Regular menu prices (non–strawberry-matcha)
    if (!isStrawberryMatcha && (almostEqual(rounded, 8) || almostEqual(rounded, 8.5))) {
      return { size: "regular", label: "Regular" };
    }
  }

  return { size: "other", label: sizeLabel("other") };
}

function almostEqual(a: number, b: number, eps = 0.01): boolean {
  return Math.abs(a - b) <= eps;
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
    unitPrice?: number | null;
    sku?: string | null;
    notes?: string | null;
    siblingSize?: DrinkSize | null;
    soldAt?: Date | null;
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
    const unitPrice =
      Number(line.unitPrice) || (qty > 0 ? total / qty : 0) || 0;
    const { size, label } = classifyDrinkSize(
      line.productName,
      line.notes,
      line.siblingSize,
      line.soldAt,
      unitPrice
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

  const order: DrinkSize[] = ["small", "regular", "large", "other"];
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
      unitPrice: true,
      notes: true,
      product: { select: { sku: true } },
      sale: { select: { soldAt: true } },
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
      unitPrice: l.unitPrice,
      notes: l.notes,
      sku: l.product?.sku ?? null,
      siblingSize: siblingBySale.get(l.saleId) ?? null,
      soldAt: l.sale.soldAt,
    }))
  );
}
