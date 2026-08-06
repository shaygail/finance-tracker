import { db } from "@/lib/db";

/** Total POS sales revenue (inc GST). Falls back to product aggregates if no sales synced. */
export async function getTotalRevenue(businessId: string): Promise<number> {
  const saleAgg = await db.sale.aggregate({
    where: { businessId },
    _sum: { totalAmount: true },
  });

  if (saleAgg._sum.totalAmount && saleAgg._sum.totalAmount > 0) {
    return saleAgg._sum.totalAmount;
  }

  const products = await db.product.findMany({ where: { businessId } });
  return products.reduce((s, p) => s + p.revenue, 0);
}

/** Output GST collected on POS sales. */
export async function getOutputGstFromSales(businessId: string): Promise<number> {
  const agg = await db.sale.aggregate({
    where: { businessId },
    _sum: { gstAmount: true },
  });
  return agg._sum.gstAmount ?? 0;
}

export interface BestSellerRow {
  id: string;
  name: string;
  sku: string | null;
  unitsSold: number;
  revenue: number;
  cogs: number;
  posProductId: string | null;
}

export async function getBestSellers(
  businessId: string,
  limit = 10
): Promise<BestSellerRow[]> {
  return db.product.findMany({
    where: { businessId },
    orderBy: { revenue: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      sku: true,
      unitsSold: true,
      revenue: true,
      cogs: true,
      posProductId: true,
    },
  });
}

export interface SalesSummary {
  totalSales: number;
  totalRevenue: number;
  totalGst: number;
  avgOrderValue: number;
}

export async function getSalesSummary(businessId: string): Promise<SalesSummary> {
  const [count, agg] = await Promise.all([
    db.sale.count({ where: { businessId } }),
    db.sale.aggregate({
      where: { businessId },
      _sum: { totalAmount: true, gstAmount: true },
    }),
  ]);

  const totalRevenue = agg._sum.totalAmount ?? 0;
  return {
    totalSales: count,
    totalRevenue,
    totalGst: agg._sum.gstAmount ?? 0,
    avgOrderValue: count > 0 ? totalRevenue / count : 0,
  };
}

/** Daily revenue for charts (last N days). */
export async function getDailySales(
  businessId: string,
  days = 30
): Promise<Array<{ date: string; revenue: number; orders: number }>> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const sales = await db.sale.findMany({
    where: { businessId, soldAt: { gte: since } },
    select: { soldAt: true, totalAmount: true },
    orderBy: { soldAt: "asc" },
  });

  const byDay = new Map<string, { revenue: number; orders: number }>();
  for (const s of sales) {
    const key = s.soldAt.toISOString().slice(0, 10);
    const cur = byDay.get(key) ?? { revenue: 0, orders: 0 };
    cur.revenue += s.totalAmount;
    cur.orders += 1;
    byDay.set(key, cur);
  }

  return Array.from(byDay.entries()).map(([date, data]) => ({
    date,
    revenue: Math.round(data.revenue * 100) / 100,
    orders: data.orders,
  }));
}
