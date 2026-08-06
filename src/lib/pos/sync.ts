import { db } from "@/lib/db";
import { calculateGstFromInc } from "@/lib/gst/nz";
import { syncGoalsFromSurplus } from "@/lib/surplus";
import {
  fetchPosProducts,
  fetchPosSales,
  fetchPosSaleLines,
  testPosConnection,
} from "./client";
import { isPosConfigured } from "./config";

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
  if (lower.includes("card") || lower.includes("eftpos")) return "Card/EFTPOS";
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
      error: "POS_DATABASE_URL is not set. Add your POS Postgres connection string to .env",
    };
  }

  const connection = await testPosConnection();
  if (!connection.ok) {
    return {
      ok: false,
      productsSync: 0,
      salesSync: 0,
      error: connection.error ?? "Could not connect to POS database",
    };
  }

  const business = await db.business.findUnique({ where: { id: businessId } });
  const since = business?.posLastSyncedAt ?? undefined;

  try {
    const posProducts = await fetchPosProducts();
    let productsSync = 0;

    for (const pp of posProducts) {
      const existing = await db.product.findFirst({
        where: { businessId, posProductId: pp.id },
      });

      if (existing) {
        await db.product.update({
          where: { id: existing.id },
          data: {
            name: pp.name,
            sku: pp.sku,
            unitPrice: pp.price,
            lastSyncedAt: new Date(),
          },
        });
      } else {
        const byName = await db.product.findFirst({
          where: { businessId, name: pp.name },
        });
        if (byName) {
          await db.product.update({
            where: { id: byName.id },
            data: {
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
              name: pp.name,
              sku: pp.sku,
              unitPrice: pp.price,
              lastSyncedAt: new Date(),
            },
          });
        }
      }
      productsSync++;
    }

    const posSales = await fetchPosSales(since);
    const saleIds = posSales.map((s) => s.id);
    const posLines = await fetchPosSaleLines(saleIds);

    const linesBySale = new Map<string, typeof posLines>();
    for (const line of posLines) {
      const list = linesBySale.get(line.saleId) ?? [];
      list.push(line);
      linesBySale.set(line.saleId, list);
    }

    const productMap = new Map(
      (
        await db.product.findMany({
          where: { businessId },
          select: { id: true, posProductId: true },
        })
      )
        .filter((p) => p.posProductId)
        .map((p) => [p.posProductId!, p.id])
    );

    let salesSync = 0;

    for (const ps of posSales) {
      const existing = await db.sale.findUnique({
        where: { businessId_posSaleId: { businessId, posSaleId: ps.id } },
      });
      if (existing) continue;

      const gst = calculateGstFromInc(ps.total);
      const sale = await db.sale.create({
        data: {
          businessId,
          posSaleId: ps.id,
          soldAt: ps.soldAt,
          totalAmount: ps.total,
          paymentMode: normalizePayment(ps.payment),
          amountExGst: gst.amountExGst,
          gstAmount: gst.gstAmount,
          amountIncGst: gst.amountIncGst,
          source: "pos",
        },
      });

      const lines = linesBySale.get(ps.id) ?? [];
      for (const line of lines) {
        await db.saleLine.create({
          data: {
            saleId: sale.id,
            productId: line.productId ? productMap.get(line.productId) : null,
            posProductId: line.productId,
            productName: line.productName,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal || line.quantity * line.unitPrice,
          },
        });
      }
      salesSync++;
    }

    await recalculateProductStats(businessId);

    await db.business.update({
      where: { id: businessId },
      data: { posLastSyncedAt: new Date() },
    });

    await db.posSyncLog.create({
      data: {
        businessId,
        productsSync,
        salesSync,
        status: "success",
        message: since
          ? `Incremental sync since ${since.toISOString()}`
          : "Full sync",
      },
    });

    await syncGoalsFromSurplus(businessId);

    return { ok: true, productsSync, salesSync };
  } catch (e) {
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

async function recalculateProductStats(businessId: string): Promise<void> {
  const products = await db.product.findMany({ where: { businessId } });

  for (const product of products) {
    const agg = await db.saleLine.aggregate({
      where: {
        productId: product.id,
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
    lastSyncedAt: business?.posLastSyncedAt,
    lastLog,
    saleCount,
  };
}
