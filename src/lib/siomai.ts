/**
 * Siomai pack sales from POS sale lines (6pc / 12pc / tubs).
 * Excludes chilli oil and other non-siomai snack add-ons.
 */

import { db } from "@/lib/db";

export type SiomaiPackSize = "6pc" | "12pc" | "5pc" | "other";

export interface SiomaiSummary {
  packs: number;
  pieces: number;
  revenue: number;
  bySize: Array<{
    size: SiomaiPackSize;
    label: string;
    packs: number;
    pieces: number;
    revenue: number;
  }>;
  topLines: Array<{
    productName: string;
    packs: number;
    revenue: number;
  }>;
}

function isSiomaiLine(productName: string, sku?: string | null): boolean {
  const name = productName.trim();
  if (!name) return false;
  const hay = `${name} ${sku ?? ""}`.toLowerCase();

  if (/\bchilli\s*oil\b/.test(hay)) return false;
  if (/\bsiomai\b/.test(hay)) return true;
  if (/\bpork\s*shrimp\b/.test(hay)) return true;
  // POS sometimes labels packs as "12 pcs (1 tub)" under Siomai category
  if (/\b12\s*pcs?\b/.test(hay) && /\btub\b/.test(hay)) return true;
  if (sku?.toLowerCase().includes("siomai")) return true;
  return false;
}

export function classifySiomaiPack(productName: string): {
  size: SiomaiPackSize;
  piecesPerPack: number;
  label: string;
} {
  const n = productName.toLowerCase();
  if (/\b12\s*pcs?\b/.test(n) || /\btub\b/.test(n)) {
    return { size: "12pc", piecesPerPack: 12, label: "12 pcs / tub" };
  }
  if (/\b6\s*pcs?\b/.test(n) || /\b6pc\b/.test(n)) {
    return { size: "6pc", piecesPerPack: 6, label: "6 pcs" };
  }
  if (/\b5\s*pcs?\b/.test(n) || /\b5pc\b/.test(n)) {
    return { size: "5pc", piecesPerPack: 5, label: "5 pcs" };
  }
  return { size: "other", piecesPerPack: 0, label: "Other siomai" };
}

export function summariseSiomaiLines(
  lines: Array<{
    productName: string;
    quantity: number;
    lineTotal: number;
    sku?: string | null;
  }>
): SiomaiSummary {
  const sizeMap = new Map<
    SiomaiPackSize,
    { label: string; packs: number; pieces: number; revenue: number }
  >();
  const nameMap = new Map<string, { packs: number; revenue: number }>();

  let packs = 0;
  let pieces = 0;
  let revenue = 0;

  for (const line of lines) {
    if (!isSiomaiLine(line.productName, line.sku)) continue;
    const qty = Number(line.quantity) || 0;
    const total = Number(line.lineTotal) || 0;
    const { size, piecesPerPack, label } = classifySiomaiPack(line.productName);

    packs += qty;
    pieces += qty * piecesPerPack;
    revenue += total;

    const cur = sizeMap.get(size) ?? { label, packs: 0, pieces: 0, revenue: 0 };
    cur.packs += qty;
    cur.pieces += qty * piecesPerPack;
    cur.revenue += total;
    sizeMap.set(size, cur);

    const byName = nameMap.get(line.productName) ?? { packs: 0, revenue: 0 };
    byName.packs += qty;
    byName.revenue += total;
    nameMap.set(line.productName, byName);
  }

  const order: SiomaiPackSize[] = ["6pc", "12pc", "5pc", "other"];
  const bySize = order
    .filter((s) => sizeMap.has(s))
    .map((s) => {
      const row = sizeMap.get(s)!;
      return {
        size: s,
        label: row.label,
        packs: Math.round(row.packs * 100) / 100,
        pieces: Math.round(row.pieces * 100) / 100,
        revenue: Math.round(row.revenue * 100) / 100,
      };
    });

  const topLines = Array.from(nameMap.entries())
    .map(([productName, v]) => ({
      productName,
      packs: Math.round(v.packs * 100) / 100,
      revenue: Math.round(v.revenue * 100) / 100,
    }))
    .sort((a, b) => b.packs - a.packs)
    .slice(0, 8);

  return {
    packs: Math.round(packs * 100) / 100,
    pieces: Math.round(pieces * 100) / 100,
    revenue: Math.round(revenue * 100) / 100,
    bySize,
    topLines,
  };
}

export async function getSiomaiSold(businessId: string): Promise<SiomaiSummary> {
  const lines = await db.saleLine.findMany({
    where: { sale: { businessId } },
    select: {
      productName: true,
      quantity: true,
      lineTotal: true,
      product: { select: { sku: true } },
    },
  });

  return summariseSiomaiLines(
    lines.map((l) => ({
      productName: l.productName,
      quantity: l.quantity,
      lineTotal: l.lineTotal,
      sku: l.product?.sku ?? null,
    }))
  );
}
