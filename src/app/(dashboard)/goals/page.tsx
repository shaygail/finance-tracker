import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getBusinessSurplus } from "@/lib/surplus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Wallet } from "lucide-react";

export default async function GoalsPage() {
  const businessId = await getBusinessId();

  const [goals, surplus] = await Promise.all([
    db.savingsGoal.findMany({
      where: { businessId },
      orderBy: { deadline: "asc" },
    }),
    getBusinessSurplus(businessId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Savings Goals</h1>
        <p className="text-slate-500">Track progress toward business targets</p>
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
              Updates automatically when you import or add transactions
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {goals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-slate-400">
              No savings goals configured
            </CardContent>
          </Card>
        ) : (
          goals.map((goal) => {
            const progress =
              goal.targetAmount > 0
                ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
                : 0;
            const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);

            return (
              <Card key={goal.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-emerald-600" />
                    {goal.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-bold text-slate-900">
                        {formatCurrency(goal.currentAmount)}
                      </p>
                      <p className="text-sm text-slate-500">
                        of {formatCurrency(goal.targetAmount)} target
                      </p>
                    </div>
                    <p className="text-2xl font-bold text-emerald-600">{progress.toFixed(0)}%</p>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-sm text-slate-500">
                    <span>{formatCurrency(remaining)} remaining</span>
                    {goal.deadline && <span>Due {formatDate(goal.deadline)}</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
