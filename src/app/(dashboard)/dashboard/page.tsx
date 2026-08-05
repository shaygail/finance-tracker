import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExpensePieChart, RevenueBarChart } from "@/components/dashboard/charts";
import { AlertTriangle, TrendingDown, TrendingUp, Wallet } from "lucide-react";

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

  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.totalAmount, 0);

  const totalGst = transactions.reduce((sum, t) => sum + t.gstAmount, 0);

  const totalRevenue = products.reduce((sum, p) => sum + p.revenue, 0);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500">{business?.name ?? "Your business"}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-red-100 p-3">
              <TrendingDown className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Expenses</p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(totalExpenses)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-emerald-100 p-3">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Product Revenue</p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(totalRevenue)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-blue-100 p-3">
              <Wallet className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">GST Collected/Paid</p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(totalGst)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-amber-100 p-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Low Stock Items</p>
              <p className="text-xl font-bold text-slate-900">{lowStock.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Low Stock Alerts</CardTitle>
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
