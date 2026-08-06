import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { formatCurrency } from "@/lib/utils";
import { calculateFinanceTotals } from "@/lib/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExpensePieChart, RevenueBarChart } from "@/components/dashboard/charts";
import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Package,
  Receipt,
  Landmark,
  Wallet,
} from "lucide-react";

export default async function DashboardPage() {
  const businessId = await getBusinessId();

  const [transactions, products, ingredients, business] = await Promise.all([
    db.transaction.findMany({
      where: { businessId },
      include: { category: true },
      orderBy: { date: "desc" },
    }),
    db.product.findMany({
      where: { businessId },
      orderBy: { revenue: "desc" },
    }),
    db.ingredient.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
    }),
    db.business.findUnique({ where: { id: businessId } }),
  ]);

  const { revenue, expenses, cogs, tax, income } = calculateFinanceTotals(
    products,
    transactions
  );

  const expenseByCategory = transactions
    .filter((t) => t.type === "expense" && t.category)
    .reduce(
      (acc, t) => {
        const name = t.category!.name;
        acc[name] = (acc[name] ?? 0) + t.totalAmount;
        return acc;
      },
      {} as Record<string, number>
    );

  const pieData = Object.entries(expenseByCategory).map(([name, value]) => ({
    name,
    value: Math.round(value * 100) / 100,
  }));

  const barData = products.map((p) => ({
    name: p.name.length > 12 ? p.name.slice(0, 12) + "…" : p.name,
    revenue: p.revenue,
  }));

  const lowStock = ingredients.filter((i) => i.currentStock <= i.parLevel);

  const bestSellers = products.slice(0, 5);

  const kpis = [
    {
      label: "Revenue",
      value: revenue,
      icon: TrendingUp,
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      valueClass: "text-emerald-700",
    },
    {
      label: "Expenses",
      value: expenses,
      icon: TrendingDown,
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      valueClass: "text-slate-900",
    },
    {
      label: "COGS",
      value: cogs,
      icon: Package,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      valueClass: "text-slate-900",
    },
    {
      label: "Tax (GST)",
      value: tax,
      icon: Landmark,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      valueClass: "text-slate-900",
      hint: tax >= 0 ? "Net payable" : "Net refund",
    },
    {
      label: "Income",
      value: income,
      icon: Wallet,
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
      valueClass: income >= 0 ? "text-emerald-700" : "text-red-600",
      hint: "Revenue − COGS − Expenses",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500">{business?.name ?? "Your business"}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className={`rounded-lg p-3 ${kpi.iconBg}`}>
                <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-slate-500">{kpi.label}</p>
                <p className={`truncate text-xl font-bold ${kpi.valueClass}`}>
                  {formatCurrency(kpi.value)}
                </p>
                {"hint" in kpi && kpi.hint ? (
                  <p className="truncate text-xs text-slate-400">{kpi.hint}</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {lowStock.length > 0 && (
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-amber-100 p-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">
                {lowStock.length} low stock item{lowStock.length === 1 ? "" : "s"}
              </p>
              <p className="text-sm text-slate-500">
                Check inventory to restock below par level
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpensePieChart data={pieData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Product Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueBarChart data={barData} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Best Sellers</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 font-medium">Units</th>
                  <th className="pb-2 font-medium text-right">Revenue</th>
                  <th className="pb-2 font-medium text-right">COGS</th>
                </tr>
              </thead>
              <tbody>
                {bestSellers.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50">
                    <td className="py-2 font-medium text-slate-900">{p.name}</td>
                    <td className="py-2 text-slate-600">{p.unitsSold}</td>
                    <td className="py-2 text-right text-slate-900">
                      {formatCurrency(p.revenue)}
                    </td>
                    <td className="py-2 text-right text-slate-600">
                      {formatCurrency(p.cogs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-slate-500" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className="text-sm text-slate-400">All ingredients stocked adequately</p>
            ) : (
              <ul className="space-y-2">
                {lowStock.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2"
                  >
                    <span className="font-medium text-slate-900">{i.name}</span>
                    <Badge variant="warning">
                      {i.currentStock} / {i.parLevel} {i.unit}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
