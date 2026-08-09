import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  getSalesSummary,
  getDailySales,
  getBestSellers,
} from "@/lib/revenue";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SalesTrendChart } from "@/components/reports/sales-trend-chart";
import { BarChart3, ShoppingCart } from "lucide-react";
import Link from "next/link";

export default async function SalesReportPage() {
  const businessId = await getBusinessId();

  const [summary, daily, bestSellers, business, recentSales] = await Promise.all([
    getSalesSummary(businessId),
    getDailySales(businessId, 30),
    getBestSellers(businessId, 10),
    db.business.findUnique({ where: { id: businessId } }),
    db.sale.findMany({
      where: { businessId },
      orderBy: { soldAt: "desc" },
      take: 20,
      include: { lines: true },
    }),
  ]);

  const hasPosSales = summary.totalSales > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales Report</h1>
          <p className="text-slate-500">
            {business?.name} — sales & order history
          </p>
        </div>
        {business?.posLastSyncedAt && (
          <Badge variant="muted">
            Synced {formatDate(business.posLastSyncedAt)}
          </Badge>
        )}
      </div>

      {!hasPosSales && (
        <Card>
          <CardContent className="py-8 text-center">
            <ShoppingCart className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="font-medium text-slate-700">No sales yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Import a sales CSV or sync POS in{" "}
              <Link href="/settings" className="text-emerald-600 hover:underline">
                Settings
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Total orders</p>
            <p className="text-2xl font-bold text-slate-900">{summary.totalSales}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Total revenue</p>
            <p className="text-2xl font-bold text-emerald-700">
              {formatCurrency(summary.totalRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Output GST</p>
            <p className="text-2xl font-bold text-slate-900">
              {formatCurrency(summary.totalGst)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Avg order value</p>
            <p className="text-2xl font-bold text-slate-900">
              {formatCurrency(summary.avgOrderValue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {daily.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-600" />
              Daily revenue (last 30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SalesTrendChart data={daily} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Best sellers</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium text-right">Units</th>
                  <th className="px-4 py-3 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {bestSellers.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-900">{p.name}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{p.unitsSold}</td>
                    <td className="px-4 py-2 text-right font-medium text-slate-900">
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
            <CardTitle>Recent orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            {recentSales.map((s) => (
              <div key={s.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">
                      {s.customerName || "Guest"} · {formatDate(s.soldAt)}
                    </p>
                    <p className="text-xs text-slate-500">{s.paymentMode}</p>
                  </div>
                  <p className="font-semibold text-slate-900">
                    {formatCurrency(s.totalAmount)}
                  </p>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {s.lines.map((line) => (
                    <li key={line.id} className="text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-slate-800">
                          {line.quantity}× {line.productName}
                        </span>
                        <span className="shrink-0 text-slate-700">
                          {formatCurrency(line.lineTotal)}
                        </span>
                      </div>
                      {line.notes && (
                        <p className="text-xs text-slate-500">{line.notes}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
