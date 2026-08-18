/**
 * Sale channel from POS order tags / payment:
 * - Uber Eats: payment uber_* or __ORDER__ ubereats / __UBER__
 * - Online: __ORDER__ online pickup
 * - Stall: stall / market / walk-up (default)
 */

import { db } from "@/lib/db";

export const SALE_CHANNELS = ["uber_eats", "online", "stall"] as const;
export type SaleChannel = (typeof SALE_CHANNELS)[number];

export const SALE_CHANNEL_LABELS: Record<SaleChannel, string> = {
  uber_eats: "Uber Eats",
  online: "Online",
  stall: "Stall",
};

export function classifySaleChannel(
  payment: string | null | undefined,
  orderDescription: string | null | undefined
): SaleChannel {
  const pay = (payment ?? "").toLowerCase();
  const desc = (orderDescription ?? "").toLowerCase();

  if (
    pay.includes("uber") ||
    desc.includes("ubereats") ||
    desc.includes("uber eats") ||
    desc.includes("__uber__") ||
    /__order__\s*ubereats/.test(desc)
  ) {
    return "uber_eats";
  }

  if (desc.includes("online")) {
    return "online";
  }

  return "stall";
}

export interface ChannelSummaryRow {
  channel: SaleChannel;
  label: string;
  orders: number;
  revenue: number;
  avgOrderValue: number;
}

export interface ChannelSalesSummary {
  totalOrders: number;
  totalRevenue: number;
  byChannel: ChannelSummaryRow[];
}

export async function getSalesByChannel(
  businessId: string
): Promise<ChannelSalesSummary> {
  const grouped = await db.sale.groupBy({
    by: ["channel"],
    where: { businessId },
    _count: { _all: true },
    _sum: { totalAmount: true },
  });

  const byKey = new Map(
    grouped.map((g) => [
      g.channel as SaleChannel,
      {
        orders: g._count._all,
        revenue: g._sum.totalAmount ?? 0,
      },
    ])
  );

  const byChannel: ChannelSummaryRow[] = SALE_CHANNELS.map((channel) => {
    const row = byKey.get(channel) ?? { orders: 0, revenue: 0 };
    return {
      channel,
      label: SALE_CHANNEL_LABELS[channel],
      orders: row.orders,
      revenue: row.revenue,
      avgOrderValue: row.orders > 0 ? row.revenue / row.orders : 0,
    };
  });

  return {
    totalOrders: byChannel.reduce((s, r) => s + r.orders, 0),
    totalRevenue: byChannel.reduce((s, r) => s + r.revenue, 0),
    byChannel,
  };
}
