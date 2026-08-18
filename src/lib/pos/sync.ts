import { db } from "@/lib/db";
import { calculateGstFromInc } from "@/lib/gst/nz";
import { syncGoalsFromSurplus } from "@/lib/surplus";
import { clearPosApiCache } from "./api-client";
import {
  fetchPosProducts,
  fetchPosSales,
  fetchPosSaleLines,
  testPosConnection,
} from "./client";
import { getPosTransport, isPosConfigured } from "./config";
import { canonicalizeProductName } from "./product-aliases";
import type { PosSaleLineRow } from "./types";

export interface PosSyncResult {
  ok: boolean;
  productsSync: number;
  salesSync: number;
  message?: string;
  error?: string;
}

function normalizePayment(raw: string | null): string {
  if (!raw) return "Other";
  const lower = raw.toLowerCase();
  if (lower.includes("uber")) return "Uber Eats";
  if (lower.includes("afterpay")) return "Card/AfterPay";
  if (lower.includes("bank")) return "Bank Transfer";
  if (lower.includes("card") || lower.includes("eftpos") || lower.includes("visa")) {
    return "Card/EFTPOS";
  }
  if (lower.includes("cash")) return "Cash";
  if (lower.includes("debit")) return "Direct Debit";
  return raw;
}

export async function syncFromPos(businessId: string): Promise<PosSyncResult> {
  if (!isPosConfigured()) {
    return {
      ok: false,
      productsSync: 0,
      salesSync: 0,
      error:
        "POS is not configured. Set POS_API_URL (public POS app URL) or POS_DATABASE_URL in .env",
    };
  }

  const business = await db.business.findUnique({ where: { id: businessId } });
  if (business && business.posSyncEnabled === false) {
    return {
      ok: false,
      productsSync: 0,
      salesSync: 0,
      error: "POS sync is disabled. Enable it in Settings to sync again.",
    };
  }

  clearPosApiCache();

  const connection = await testPosConnection();
  if (!connection.ok) {
    return {
      ok: false,
      productsSync: 0,
      salesSync: 0,
      error: connection.error ?? "Could not connect to POS",
    };
  }

  const since = business?.posLastSyncedAt ?? undefined;

  try {
    const posProducts = await fetchPosProducts();
    let productsSync = 0;

    for (const pp of posProducts) {
      const name = canonicalizeProductName(pp.name);
      const existing = await db.product.findFirst({
        where: { businessId, posProductId: pp.id },
      });

      if (existing) {
        await db.product.update({
          where: { id: existing.id },
          data: {
            name,
            sku: pp.sku,
            unitPrice: pp.price,
            lastSyncedAt: new Date(),
          },
        });
      } else {
        const byName = await db.product.findFirst({
          where: {
            businessId,
            name: { equals: name, mode: "insensitive" },
          },
        });
        if (byName) {
          await db.product.update({
            where: { id: byName.id },
            data: {
              name,
              posProductId: pp.id,
              sku: pp.sku ?? byName.sku,
              unitPrice: pp.price,
              lastSyncedAt: new Date(),
            },
          });
        } else {
          await db.product.create({
            data: {
              businessId,
              posProductId: pp.id,
              name,
              sku: pp.sku,
              unitPrice: pp.price,
              lastSyncedAt: new Date(),
            },
          });
        }
      }
      productsSync++;
    }

    // Older imports skipped customisation notes — one full pass when many lines lack them.
    const [missingNotes, totalLines] = await Promise.all([
      db.saleLine.count({
        where: {
          sale: { businessId },
          OR: [{ notes: null }, { notes: "" }],
        },
      }),
      db.saleLine.count({ where: { sale: { businessId } } }),
    ]);
    const needsNotesBackfill =
      totalLines > 0 && missingNotes / totalLines > 0.2;
    const salesSince = needsNotesBackfill ? undefined : since;
    const posSales = await fetchPosSales(salesSince);
    const saleIds = posSales.map((s) => s.id);
    const posLines = await fetchPosSaleLines(saleIds);

    const linesBySale = new Map<string, typeof posLines>();
    for (const line of posLines) {
      const list = linesBySale.get(line.saleId) ?? [];
      list.push(line);
      linesBySale.set(line.saleId, list);
    }

    const allProducts = await db.product.findMany({
      where: { businessId },
      select: { id: true, posProductId: true, name: true },
    });

    const productByPosId = new Map<string, string>();
    const productByName = new Map<string, string>();
    for (const p of allProducts) {
      if (p.posProductId) productByPosId.set(p.posProductId, p.id);
      productByName.set(p.name.trim().toLowerCase(), p.id);
    }

    async function resolveProductId(
      posProductId: string | null,
      productName: string,
      unitPrice: number
    ): Promise<{ productId: string | null; displayName: string }> {
      const displayName = canonicalizeProductName(productName);
      if (posProductId && productByPosId.has(posProductId)) {
        return { productId: productByPosId.get(posProductId)!, displayName };
      }
      const key = displayName.trim().toLowerCase();
      if (key && productByName.has(key)) {
        return { productId: productByName.get(key)!, displayName };
      }
      if (!key) return { productId: null, displayName };

      // Sale item ids (e.g. web-cc-003) often differ from menu ids — create/link by name
      const created = await db.product.create({
        data: {
          businessId,
          name: displayName,
          posProductId: posProductId && !productByPosId.has(posProductId) ? posProductId : null,
          unitPrice,
          unitsSold: 0,
          revenue: 0,
          lastSyncedAt: new Date(),
        },
      });
      productByName.set(key, created.id);
      if (created.posProductId) productByPosId.set(created.posProductId, created.id);
      return { productId: created.id, displayName };
    }

    const existingSales = await db.sale.findMany({
      where: { businessId },
      include: { lines: { orderBy: { id: "asc" } } },
    });
    const existingByPosId = new Map(existingSales.map((s) => [s.posSaleId, s]));

    let salesSync = 0;
    let notesBackfill = 0;
    const noteUpdates: Array<{ id: string; notes: string }> = [];

    for (const ps of posSales) {
      const lines = linesBySale.get(ps.id) ?? [];
      const existing = existingByPosId.get(ps.id);

      if (existing) {
        noteUpdates.push(...collectSaleLineNoteUpdates(existing.lines, lines));
        continue;
      }

      const gst = calculateGstFromInc(ps.total);

      const sale = await db.sale.create({
        data: {
          businessId,
          posSaleId: ps.id,
          soldAt: ps.soldAt,
          customerName: ps.customerName ?? null,
          totalAmount: ps.total,
          paymentMode: normalizePayment(ps.payment),
          amountExGst: gst.amountExGst,
          gstAmount: gst.gstAmount,
          amountIncGst: gst.amountIncGst,
          source: "pos",
        },
      });

      for (const line of lines) {
        const { productId, displayName } = await resolveProductId(
          line.productId,
          line.productName,
          line.unitPrice
        );
        await db.saleLine.create({
          data: {
            saleId: sale.id,
            productId,
            posProductId: line.productId,
            productName: displayName,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal || line.quantity * line.unitPrice,
            notes: line.notes ?? null,
          },
        });
      }
      salesSync++;
      if (salesSync % 50 === 0) {
        console.log(`  …imported ${salesSync} new sales`);
      }
    }

    for (let i = 0; i < noteUpdates.length; i += 100) {
      const chunk = noteUpdates.slice(i, i + 100);
      await Promise.all(
        chunk.map((u) =>
          db.saleLine.update({ where: { id: u.id }, data: { notes: u.notes } })
        )
      );
      notesBackfill += chunk.length;
      if (i + 100 < noteUpdates.length || chunk.length > 0) {
        console.log(`  …refreshed add-ons on ${notesBackfill}/${noteUpdates.length} lines`);
      }
    }

    await linkSaleLinesToProducts(businessId);
    await recalculateProductStats(businessId);

    await db.business.update({
      where: { id: businessId },
      data: { posLastSyncedAt: new Date() },
    });

    const transport = getPosTransport();
    await db.posSyncLog.create({
      data: {
        businessId,
        productsSync,
        salesSync,
        status: "success",
        message: [
          salesSince
            ? `Incremental ${transport} sync since ${salesSince.toISOString()}`
            : `Full ${transport} sync`,
          notesBackfill > 0 ? `updated add-ons on ${notesBackfill} lines` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      },
    });

    await syncGoalsFromSurplus(businessId);
    clearPosApiCache();

    return {
      ok: true,
      productsSync,
      salesSync,
      message:
        notesBackfill > 0
          ? `Synced ${salesSync} new sales; refreshed add-ons on ${notesBackfill} lines`
          : undefined,
    };
  } catch (e) {
    clearPosApiCache();
    const error = e instanceof Error ? e.message : "Sync failed";
    await db.posSyncLog.create({
      data: {
        businessId,
        status: "error",
        message: error,
      },
    });
    return { ok: false, productsSync: 0, salesSync: 0, error };
  }
}

/** Match POS lines onto existing DB lines; return note updates (no DB writes). */
function collectSaleLineNoteUpdates(
  dbLines: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    notes: string | null;
  }>,
  posLines: PosSaleLineRow[]
): Array<{ id: string; notes: string }> {
  if (dbLines.length === 0 || posLines.length === 0) return [];

  const used = new Set<number>();
  const updates: Array<{ id: string; notes: string }> = [];

  for (const dbLine of dbLines) {
    let matchIdx = posLines.findIndex(
      (pl, i) =>
        !used.has(i) &&
        canonicalizeProductName(pl.productName).trim().toLowerCase() ===
          dbLine.productName.trim().toLowerCase() &&
        Math.abs(pl.quantity - dbLine.quantity) < 0.001 &&
        Math.abs(pl.unitPrice - dbLine.unitPrice) < 0.001
    );
    if (matchIdx < 0) {
      matchIdx = posLines.findIndex(
        (pl, i) =>
          !used.has(i) &&
          canonicalizeProductName(pl.productName).trim().toLowerCase() ===
            dbLine.productName.trim().toLowerCase()
      );
    }
    if (matchIdx < 0) continue;
    used.add(matchIdx);

    const notes = posLines[matchIdx].notes ?? null;
    if (!notes || notes === dbLine.notes) continue;
    updates.push({ id: dbLine.id, notes });
  }

  return updates;
}

async function linkSaleLinesToProducts(businessId: string): Promise<void> {
  const products = await db.product.findMany({
    where: { businessId },
    select: { id: true, name: true, posProductId: true },
  });
  const byName = new Map(products.map((p) => [p.name.trim().toLowerCase(), p.id]));
  const byPosId = new Map(
    products.filter((p) => p.posProductId).map((p) => [p.posProductId!, p.id])
  );

  const unlinked = await db.saleLine.findMany({
    where: { productId: null, sale: { businessId } },
    select: {
      id: true,
      productName: true,
      posProductId: true,
      unitPrice: true,
    },
  });

  for (const line of unlinked) {
    const displayName = canonicalizeProductName(line.productName);
    let productId =
      (line.posProductId ? byPosId.get(line.posProductId) : undefined) ??
      byName.get(displayName.trim().toLowerCase());

    if (!productId) {
      const name = displayName.trim();
      if (!name) continue;
      // Skip combo/manual labels that aren't real menu items
      if (/[×+]/.test(name) || /^1x\s/i.test(name) || name.includes(",")) continue;

      const created = await db.product.create({
        data: {
          businessId,
          name,
          posProductId:
            line.posProductId && !byPosId.has(line.posProductId)
              ? line.posProductId
              : null,
          unitPrice: line.unitPrice,
          unitsSold: 0,
          revenue: 0,
        },
      });
      productId = created.id;
      byName.set(name.toLowerCase(), productId);
      if (created.posProductId) byPosId.set(created.posProductId, productId);
    }

    await db.saleLine.update({
      where: { id: line.id },
      data: { productId, productName: displayName },
    });
  }
}

async function recalculateProductStats(businessId: string): Promise<void> {
  const products = await db.product.findMany({ where: { businessId } });

  for (const product of products) {
    const agg = await db.saleLine.aggregate({
      where: {
        OR: [
          { productId: product.id },
          {
            productId: null,
            productName: { equals: product.name, mode: "insensitive" },
            sale: { businessId },
          },
        ],
      },
      _sum: { quantity: true, lineTotal: true },
    });

    await db.product.update({
      where: { id: product.id },
      data: {
        unitsSold: agg._sum.quantity ?? 0,
        revenue: agg._sum.lineTotal ?? 0,
      },
    });
  }
}

export async function getPosStatus(businessId: string) {
  const business = await db.business.findUnique({ where: { id: businessId } });
  const lastLog = await db.posSyncLog.findFirst({
    where: { businessId },
    orderBy: { syncedAt: "desc" },
  });
  const saleCount = await db.sale.count({ where: { businessId } });

  return {
    configured: isPosConfigured(),
    syncEnabled: business?.posSyncEnabled !== false,
    lastSyncedAt: business?.posLastSyncedAt,
    lastLog,
    saleCount,
  };
}
