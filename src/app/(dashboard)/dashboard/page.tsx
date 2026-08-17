import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { formatCurrency } from "@/lib/utils";
import { getTotalRevenue, getBestSellers } from "@/lib/revenue";
import { getCupsSold } from "@/lib/cups";
import { getSiomaiSold } from "@/lib/siomai";
import {
  getCurrentFinancialYearRange,
  getPeriodForDate,
  round2,
  summariseGstPeriods,
  type GstFilingFrequency,
} from "@/lib/gst/nz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExpensePieChart, RevenueBarChart } from "@/components/dashboard/charts";
import {
  AlertTriangle,
  Coffee,
  TrendingDown,
  TrendingUp,
  Scale,
  ShoppingCart,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const businessId = await getBusinessId();
  const { start, end, label: fyLabel } = getCurrentFinancialYearRange();

  const [
    transactions,
    ingredients,
    business,
    totalRevenue,
    bestSellers,
    saleCount,
    fySales,
    cupsSold,
    siomai,
  ] = await Promise.all([
    db.transaction.findMany({
      where: { businessId },
      include: { category: true },
      orderBy: { date: "desc" },
    }),
    db.ingredient.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
    }),
    db.business.findUnique({ where: { id: businessId } }),
    getTotalRevenue(businessId),
    getBestSellers(businessId, 5),
    db.sale.count({ where: { businessId } }),
    db.sale.findMany({
      where: { businessId, soldAt: { gte: start, lte: end } },
      select: { soldAt: true, gstAmount: true },
    }),
    getCupsSold(businessId),
    getSiomaiSold(businessId),
  ]);

  const totalExpenses = transactions
    .filter((t) => t.type === "expense" || t.type === "refund")
    .reduce((sum, t) => sum + t.totalAmount, 0);

  const frequency = (business?.gstFilingFrequency ?? "two_monthly") as GstFilingFrequency;
  const fyTransactions = transactions.filter((t) => t.date >= start && t.date <= end);
  const gstPeriodRows = [
    ...fyTransactions.map((t) => ({
      date: t.date,
      type: t.type,
      gstAmount: t.gstAmount,
    })),
    ...fySales.map((s) => ({
      date: s.soldAt,
      type: "sale" as const,
      gstAmount: s.gstAmount,
    })),
  ];
  const periodSummaries = summariseGstPeriods(gstPeriodRows, fyLabel, frequency);
  const currentPeriod = getPeriodForDate(new Date(), fyLabel, frequency);
  const currentGst = periodSummaries.find((s) => s.period.id === currentPeriod?.id);
  const gstToPay = currentGst?.netGst ?? round2(
    fySales.reduce((s, x) => s + x.gstAmount, 0) -
      fyTransactions
        .filter((t) => t.type === "expense" || t.type === "refund")
        .reduce((s, t) => s + t.gstAmount, 0)
  );

  const expenseByCategory = transactions
    .filter((t) => (t.type === "expense" || t.type === "refund") && t.category)
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

  const barData = bestSellers.map((p) => ({
    name: p.name.length > 12 ? p.name.slice(0, 12) + "…" : p.name,
    revenue: p.revenue,
  }));

  const lowStock = ingredients.filter((i) => i.currentStock <= i.parLevel);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">{business?.name ?? "STLL HAUS"}</p>
        </div>
        {saleCount > 0 && (
          <Badge variant="success">{saleCount} POS orders synced</Badge>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-emerald-100 p-3">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Sales revenue</p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(totalRevenue)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-teal-100 p-3">
              <Coffee className="h-5 w-5 text-teal-700" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Cups sold</p>
              <p className="text-xl font-bold text-slate-900">
                {cupsSold.toLocaleString("en-NZ")}
              </p>
              <p className="text-xs text-slate-400">Drinks only · no siomai or milk</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-orange-100 p-3">
              <UtensilsCrossed className="h-5 w-5 text-orange-700" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Siomai packs</p>
              <p className="text-xl font-bold text-slate-900">
                {siomai.packs.toLocaleString("en-NZ")}
              </p>
              <p className="text-xs text-slate-400">
                {siomai.pieces.toLocaleString("en-NZ")} pieces ·{" "}
                {formatCurrency(siomai.revenue)}
              </p>
            </div>
          </CardContent>
        </Card>
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
        {business?.gstRegistered ? (
          <Link href="/reports/gst">
            <Card className="h-full transition-colors hover:border-emerald-300">
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="rounded-lg bg-blue-100 p-3">
                  <Scale className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">
                    GST to pay{currentPeriod ? " (current period)" : ""}
                  </p>
                  <p
                    className={`text-xl font-bold ${
                      gstToPay >= 0 ? "text-red-600" : "text-emerald-600"
                    }`}
                  >
                    {formatCurrency(Math.abs(gstToPay))}
                    {gstToPay < 0 ? " refund" : ""}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Link href="/settings">
            <Card className="h-full transition-colors hover:border-slate-300">
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="rounded-lg bg-slate-100 p-3">
                  <Scale className="h-5 w-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">GST</p>
                  <p className="text-sm font-medium text-slate-700">Not registered</p>
                  <p className="text-xs text-slate-400">Enable in Settings when ready</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-orange-600" />
            Siomai sales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {siomai.packs === 0 ? (
            <p className="text-sm text-slate-400">No siomai packs sold yet</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-orange-50 px-4 py-3">
                  <p className="text-sm text-slate-500">Packs sold</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {siomai.packs.toLocaleString("en-NZ")}
                  </p>
                </div>
                <div className="rounded-lg bg-orange-50 px-4 py-3">
                  <p className="text-sm text-slate-500">Pieces sold</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {siomai.pieces.toLocaleString("en-NZ")}
                  </p>
                </div>
                <div className="rounded-lg bg-orange-50 px-4 py-3">
                  <p className="text-sm text-slate-500">Siomai revenue</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(siomai.revenue)}
                  </p>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">By pack size</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-slate-500">
                        <th className="pb-2 font-medium">Size</th>
                        <th className="pb-2 font-medium text-right">Packs</th>
                        <th className="pb-2 font-medium text-right">Pieces</th>
                        <th className="pb-2 font-medium text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {siomai.bySize.map((row) => (
                        <tr key={row.size} className="border-b border-slate-50">
                          <td className="py-2 font-medium text-slate-900">{row.label}</td>
                          <td className="py-2 text-right text-slate-600">{row.packs}</td>
                          <td className="py-2 text-right text-slate-600">{row.pieces}</td>
                          <td className="py-2 text-right text-slate-900">
                            {formatCurrency(row.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">Top siomai items</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-slate-500">
                        <th className="pb-2 font-medium">Product</th>
                        <th className="pb-2 font-medium text-right">Packs</th>
                        <th className="pb-2 font-medium text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {siomai.topLines.map((row) => (
                        <tr key={row.productName} className="border-b border-slate-50">
                          <td className="py-2 font-medium text-slate-900">{row.productName}</td>
                          <td className="py-2 text-right text-slate-600">{row.packs}</td>
                          <td className="py-2 text-right text-slate-900">
                            {formatCurrency(row.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {saleCount === 0 && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="flex items-center gap-4 py-4">
            <ShoppingCart className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="font-medium text-slate-900">Connect your POS database</p>
              <p className="text-sm text-slate-600">
                Sync products and sales history from Settings →{" "}
                <Link href="/settings" className="text-emerald-700 hover:underline">
                  POS Integration
                </Link>
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
            <CardTitle>Best Sellers {saleCount > 0 ? "(POS)" : ""}</CardTitle>
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
