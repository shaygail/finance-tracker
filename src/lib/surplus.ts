import { db } from "@/lib/db";
import { calculateSurplus } from "@/lib/gst/nz";
import { getTotalRevenue } from "@/lib/revenue";

export async function getBusinessSurplus(businessId: string): Promise<number> {
  const [transactions, totalRevenue] = await Promise.all([
    db.transaction.findMany({
      where: {
        businessId,
        type: { in: ["expense", "refund"] },
        OR: [
          { category: null },
          { category: { slug: { not: "personal" } } },
        ],
      },
    }),
    getTotalRevenue(businessId),
  ]);

  const totalExpenses = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
  return calculateSurplus(totalRevenue, totalExpenses);
}

/**
 * Previously auto-allocated surplus into savings goals.
 * Goals are manual now — kept as a no-op so older call sites stay safe.
 */
export async function syncGoalsFromSurplus(_businessId: string): Promise<void> {
  return;
}
