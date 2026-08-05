import { db } from "@/lib/db";
import { calculateSurplus } from "@/lib/gst/nz";

export async function getBusinessSurplus(businessId: string): Promise<number> {
  const [transactions, products] = await Promise.all([
    db.transaction.findMany({
      where: { businessId, type: { in: ["expense", "refund"] } },
    }),
    db.product.findMany({ where: { businessId } }),
  ]);

  const totalExpenses = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
  const totalRevenue = products.reduce((sum, p) => sum + p.revenue, 0);

  return calculateSurplus(totalRevenue, totalExpenses);
}

/** Allocate surplus across savings goals proportionally by target share. */
export async function syncGoalsFromSurplus(businessId: string): Promise<void> {
  const surplus = await getBusinessSurplus(businessId);
  if (surplus <= 0) return;

  const goals = await db.savingsGoal.findMany({
    where: { businessId },
    orderBy: { createdAt: "asc" },
  });

  if (goals.length === 0) return;

  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  if (totalTarget <= 0) return;

  let allocated = 0;
  for (let i = 0; i < goals.length; i++) {
    const goal = goals[i];
    const share =
      i === goals.length - 1
        ? surplus - allocated
        : Math.round(surplus * (goal.targetAmount / totalTarget) * 100) / 100;
    allocated += share;
    await db.savingsGoal.update({
      where: { id: goal.id },
      data: { currentAmount: Math.min(Math.max(share, 0), goal.targetAmount) },
    });
  }
}
