/**
 * POS sale revenue grouped by payment method for dashboard / payments page.
 */

import { db } from "@/lib/db";

export const PAYMENT_BUCKETS = [
  "cash",
  "bank_transfer",
  "eftpos",
  "card",
  "uber_eats",
  "afterpay",
  "other",
] as const;

export type PaymentBucket = (typeof PAYMENT_BUCKETS)[number];

export const PAYMENT_BUCKET_LABELS: Record<PaymentBucket, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  eftpos: "EFTPOS",
  card: "Visa / Mastercard",
  uber_eats: "Uber Eats",
  afterpay: "Afterpay",
  other: "Other",
};

/** Map stored Sale.paymentMode → display bucket. */
export function paymentModeToBucket(paymentMode: string): PaymentBucket {
  const p = paymentMode.toLowerCase().trim();
  if (p.includes("uber")) return "uber_eats";
  if (p.includes("afterpay")) return "afterpay";
  if (p.includes("cash")) return "cash";
  if (p.includes("bank")) return "bank_transfer";
  if (p === "eftpos" || p.startsWith("eftpos")) return "eftpos";
  // Legacy combined label from older syncs — treat as card until POS re-sync splits
  if (p === "card/eftpos") return "card";
  if (p.includes("visa/mc") || p.includes("card (visa")) return "card";
  if (
    p.includes("visa") ||
    p.includes("mastercard") ||
    p.includes("master card") ||
    p.includes("credit card") ||
    p === "card" ||
    p.startsWith("card ")
  ) {
    return "card";
  }
  if (p.includes("card") || p.includes("contactless")) return "card";
  return "other";
}

export interface PaymentMethodRow {
  bucket: PaymentBucket;
  label: string;
  orders: number;
  revenue: number;
  share: number;
  avgOrderValue: number;
}

export interface PaymentMethodSummary {
  totalOrders: number;
  totalRevenue: number;
  byMethod: PaymentMethodRow[];
  topMethod: PaymentMethodRow | null;
}

export async function getSalesByPaymentMethod(
  businessId: string
): Promise<PaymentMethodSummary> {
  const grouped = await db.sale.groupBy({
    by: ["paymentMode"],
    where: { businessId },
    _count: { _all: true },
    _sum: { totalAmount: true },
  });

  const totals = new Map<PaymentBucket, { orders: number; revenue: number }>();
  for (const bucket of PAYMENT_BUCKETS) {
    totals.set(bucket, { orders: 0, revenue: 0 });
  }

  for (const row of grouped) {
    const bucket = paymentModeToBucket(row.paymentMode);
    const cur = totals.get(bucket)!;
    cur.orders += row._count._all;
    cur.revenue += row._sum.totalAmount ?? 0;
  }

  const totalOrders = [...totals.values()].reduce((s, r) => s + r.orders, 0);
  const totalRevenue = [...totals.values()].reduce((s, r) => s + r.revenue, 0);

  const byMethod: PaymentMethodRow[] = PAYMENT_BUCKETS.map((bucket) => {
    const row = totals.get(bucket)!;
    return {
      bucket,
      label: PAYMENT_BUCKET_LABELS[bucket],
      orders: row.orders,
      revenue: row.revenue,
      share: totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0,
      avgOrderValue: row.orders > 0 ? row.revenue / row.orders : 0,
    };
  })
    .filter((r) => r.orders > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const topMethod = byMethod[0] ?? null;

  return {
    totalOrders,
    totalRevenue,
    byMethod,
    topMethod,
  };
}
