import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { formatCurrency } from "@/lib/utils";
import { getBusinessSurplus } from "@/lib/surplus";
import { Card, CardContent } from "@/components/ui/card";
import { GoalsManager } from "@/components/goals/goals-manager";
import { Wallet } from "lucide-react";

export default async function GoalsPage() {
  const businessId = await getBusinessId();

  const [goals, surplus] = await Promise.all([
    db.savingsGoal.findMany({
      where: { businessId },
      orderBy: [{ deadline: "asc" }, { createdAt: "asc" }],
    }),
    getBusinessSurplus(businessId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Savings Goals</h1>
        <p className="text-slate-500">
          Manual targets — enter saved amounts yourself (not auto-filled from surplus)
        </p>
      </div>

      <Card>
        <CardContent className="flex items-center gap-4 pt-6">
          <div className="rounded-lg bg-emerald-100 p-3">
            <Wallet className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm text-slate-500">Available surplus (revenue − expenses)</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(surplus)}</p>
            <p className="text-xs text-slate-400">
              Informational only — goals are updated manually
            </p>
          </div>
        </CardContent>
      </Card>

      <GoalsManager
        goals={goals.map((g) => ({
          id: g.id,
          name: g.name,
          targetAmount: g.targetAmount,
          currentAmount: g.currentAmount,
          deadline: g.deadline?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
