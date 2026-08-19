import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { formatCurrency } from "@/lib/utils";
import { getTotalRevenue, getBestSellers } from "@/lib/revenue";
import { getCupsSold } from "@/lib/cups";
import { getSiomaiSold } from "@/lib/siomai";
import {
  getSalesByChannel,
} from "@/lib/sales/channels";
import { getSalesByPaymentMethod } from "@/lib/sales/payments";
import { getRentalMarketFeesSummary } from "@/lib/fees/rental-market";
import { getSubscriptionsSummary } from "@/lib/fees/subscriptions";
import { getFyProfitSummary } from "@/lib/profit/fy";
import {
  getCurrentFinancialYearRange,
  getPeriodForDate,
  round2,
  summariseGstPeriods,
  type GstFilingFrequency,
} from "@/lib/gst/nz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ExpensePieChart,
  RevenueBarChart,
  PaymentMethodBarChart,
} from "@/components/dashboard/charts";
import {
  AlertTriangle,
  Banknote,
  Coffee,
  CreditCard,
  Download,
  Store,
  Tent,
  Repeat,
  TrendingDown,
  TrendingUp,
  Scale,
  ShoppingCart,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
    channels,
    payments,
    marketFees,
    subscriptions,
    fyProfit,
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
    getSalesByChannel(businessId),
    getSalesByPaymentMethod(businessId),
    getRentalMarketFeesSummary(businessId),
    getSubscriptionsSummary(businessId),
    getFyProfitSummary(businessId),
  ]);

  const businessTx = transactions.filter(
    (t) => t.category?.slug !== "personal"
  );
  const personalTx = transactions.filter(
    (t) => t.category?.slug === "personal"
  );
  const personalDrawings = personalTx.reduce((sum, t) => sum + t.totalAmount, 0);

  const totalExpenses = businessTx
    .filter((t) => t.type === "expense" || t.type === "refund")
    .reduce((sum, t) => sum + t.totalAmount, 0);

  const frequency = (business?.gstFilingFrequency ?? "two_monthly") as GstFilingFrequency;
  const fyTransactions = businessTx.filter((t) => t.date >= start && t.date <= end);
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

  const expenseByCategory = businessTx
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Link href="/reports/profit" className="block">
          <Card className="h-full border-emerald-200 transition-colors hover:border-emerald-400">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-emerald-100 p-3">
                  <Scale className="h-6 w-6 text-emerald-700" />
                </div>
                <div>
                  <p className="text-sm text-emerald-800">
                    FY {fyProfit.fyLabel} filing profit (no cash)
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(fyProfit.profitIncGst)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Non-cash POS − expenses
                  </p>
                </div>
              </div>
              <span className="text-sm font-medium text-emerald-700">
                Open →
              </span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/reports/profit" className="block">
          <Card className="h-full border-amber-200 transition-colors hover:border-amber-400">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-amber-100 p-3">
                  <Banknote className="h-6 w-6 text-amber-700" />
                </div>
                <div>
                  <p className="text-sm text-amber-900">
                    FY {fyProfit.fyLabel} full profit (with POS cash)
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(fyProfit.profitWithCashIncGst)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Includes POS cash {formatCurrency(fyProfit.cashInPos)}
                  </p>
                </div>
              </div>
              <span className="text-sm font-medium text-amber-800">
                Open →
              </span>
            </CardContent>
          </Card>
        </Link>
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
                {cupsSold.cups.toLocaleString("en-NZ")}
              </p>
              <p className="text-xs text-slate-400">
                {formatCurrency(cupsSold.revenue)} drink revenue
              </p>
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
              {personalDrawings > 0 && (
                <p className="text-xs text-slate-400">
                  Personal drawings {formatCurrency(personalDrawings)} (not in
                  business costs)
                </p>
              )}
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/fees">
          <Card className="h-full transition-colors hover:border-amber-300">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-amber-100 p-3">
                  <Tent className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Rental / Market fees</p>
                  <p className="text-xl font-bold text-slate-900">
                    {formatCurrency(marketFees.total)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {marketFees.count} entr{marketFees.count === 1 ? "y" : "ies"}
                  </p>
                </div>
              </div>
              <span className="text-sm font-medium text-amber-800">Manage →</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/subscriptions">
          <Card className="h-full transition-colors hover:border-sky-300">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-sky-100 p-3">
                  <Repeat className="h-5 w-5 text-sky-700" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Subscriptions</p>
                  <p className="text-xl font-bold text-slate-900">
                    {formatCurrency(subscriptions.total)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {subscriptions.count} entr
                    {subscriptions.count === 1 ? "y" : "ies"} · domain, email,
                    Cursor…
                  </p>
                </div>
              </div>
              <span className="text-sm font-medium text-sky-800">Manage →</span>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-teal-700" />
              Payments
            </CardTitle>
            <Link href="/payments">
              <Button variant="outline" size="sm">
                Open payments & cash
              </Button>
            </Link>
          </div>
          {payments.topMethod && (
            <p className="text-sm font-normal text-slate-500">
              Highest: {payments.topMethod.label} (
              {formatCurrency(payments.topMethod.revenue)},{" "}
              {payments.topMethod.share.toFixed(0)}% of sales)
            </p>
          )}
        </CardHeader>
        <CardContent>
          {payments.byMethod.length === 0 ? (
            <p className="text-sm text-slate-400">
              No sales yet — sync POS or add cash on the Payments page
            </p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <PaymentMethodBarChart
                data={payments.byMethod.map((m) => ({
                  name: m.label,
                  revenue: Math.round(m.revenue * 100) / 100,
                  orders: m.orders,
                }))}
              />
              <div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-slate-500">
                      <th className="pb-2 font-medium">Method</th>
                      <th className="pb-2 font-medium text-right">Orders</th>
                      <th className="pb-2 font-medium text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.byMethod.map((row) => (
                      <tr key={row.bucket} className="border-b border-slate-50">
                        <td className="py-2 font-medium text-slate-900">
                          {row.label}
                        </td>
                        <td className="py-2 text-right text-slate-600">
                          {row.orders}
                        </td>
                        <td className="py-2 text-right text-slate-900">
                          {formatCurrency(row.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-slate-700" />
            Sales by channel
          </CardTitle>
        </CardHeader>
        <CardContent>
          {channels.totalOrders === 0 ? (
            <p className="text-sm text-slate-400">No sales yet</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              {channels.byChannel.map((row) => {
                const tone =
                  row.channel === "uber_eats"
                    ? "bg-emerald-50"
                    : row.channel === "online"
                      ? "bg-sky-50"
                      : "bg-amber-50";
                const share =
                  channels.totalRevenue > 0
                    ? (row.revenue / channels.totalRevenue) * 100
                    : 0;
                return (
                  <div key={row.channel} className={`rounded-lg ${tone} px-4 py-3`}>
                    <p className="text-sm text-slate-500">{row.label}</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {formatCurrency(row.revenue)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {row.orders.toLocaleString("en-NZ")} orders
                      {row.orders > 0
                        ? ` · avg ${formatCurrency(row.avgOrderValue)}`
                        : ""}
                    </p>
                    <p className="text-xs text-slate-500">
                      {share.toFixed(0)}% of sales revenue
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Coffee className="h-5 w-5 text-teal-700" />
              Drink sales
            </CardTitle>
            {cupsSold.cups > 0 && (
              <a href="/api/sales/export">
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export all sales
                </Button>
              </a>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {cupsSold.cups === 0 ? (
            <p className="text-sm text-slate-400">No drink cups sold yet</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-teal-50 px-4 py-3">
                  <p className="text-sm text-slate-500">Cups sold</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {cupsSold.cups.toLocaleString("en-NZ")}
                  </p>
                </div>
                <div className="rounded-lg bg-teal-50 px-4 py-3">
                  <p className="text-sm text-slate-500">Drink revenue</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(cupsSold.revenue)}
                  </p>
                </div>
                <div className="rounded-lg bg-teal-50 px-4 py-3">
                  <p className="text-sm text-slate-500">Avg per cup</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {formatCurrency(
                      cupsSold.cups > 0 ? cupsSold.revenue / cupsSold.cups : 0
                    )}
                  </p>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">By size</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-slate-500">
                        <th className="pb-2 font-medium">Size</th>
                        <th className="pb-2 font-medium text-right">Cups</th>
                        <th className="pb-2 font-medium text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cupsSold.bySize.map((row) => (
                        <tr key={row.size} className="border-b border-slate-50">
                          <td className="py-2 font-medium text-slate-900">{row.label}</td>
                          <td className="py-2 text-right text-slate-600">{row.cups}</td>
                          <td className="py-2 text-right text-slate-900">
                            {formatCurrency(row.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">Top drinks</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-slate-500">
                        <th className="pb-2 font-medium">Product</th>
                        <th className="pb-2 font-medium text-right">Cups</th>
                        <th className="pb-2 font-medium text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cupsSold.topLines.map((row) => (
                        <tr key={row.productName} className="border-b border-slate-50">
                          <td className="py-2 font-medium text-slate-900">{row.productName}</td>
                          <td className="py-2 text-right text-slate-600">{row.cups}</td>
                          <td className="py-2 text-right text-slate-900">
                            {formatCurrency(row.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Top add-ons</p>
                {cupsSold.topAddOns.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No add-ons recorded yet (needs POS notes on drinks)
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-slate-500">
                        <th className="pb-2 font-medium">Add-on</th>
                        <th className="pb-2 font-medium text-right">Times ordered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cupsSold.topAddOns.map((row) => (
                        <tr key={row.label} className="border-b border-slate-50">
                          <td className="py-2 font-medium text-slate-900">{row.label}</td>
                          <td className="py-2 text-right text-slate-600">
                            {row.count.toLocaleString("en-NZ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
