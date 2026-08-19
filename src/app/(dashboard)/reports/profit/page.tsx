import { getBusinessId } from "@/lib/session";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getFyProfitSummary } from "@/lib/profit/fy";
import { getFinancialYear } from "@/lib/gst/nz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Banknote,
  ClipboardList,
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

type Props = {
  searchParams?: Promise<{ fy?: string }>;
};

export default async function FyProfitPage({ searchParams }: Props) {
  const businessId = await getBusinessId();
  const params = searchParams ? await searchParams : {};
  const currentFy = getFinancialYear();
  const fyLabel =
    params.fy && /^\d{4}\/\d{2}$/.test(params.fy) ? params.fy : currentFy;

  const summary = await getFyProfitSummary(businessId, fyLabel);

  const priorYear = Number(fyLabel.split("/")[0]) - 1;
  const priorFy = `${priorYear}/${String(priorYear + 1).slice(2)}`;
  const nextYear = Number(fyLabel.split("/")[0]) + 1;
  const nextFy = `${nextYear}/${String(nextYear + 1).slice(2)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Financial year profit
          </h1>
          <p className="text-slate-500">
            FY {summary.fyLabel} (1 Apr – 31 Mar). Filing revenue excludes POS
            cash — cash is listed separately for your accountant.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/reports/profit?fy=${priorFy}`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            ← {priorFy}
          </Link>
          <Badge variant="default">FY {summary.fyLabel}</Badge>
          {fyLabel !== currentFy && (
            <Link
              href={`/reports/profit?fy=${nextFy}`}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              {nextFy} →
            </Link>
          )}
        </div>
      </div>

      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardContent className="flex flex-wrap items-center gap-6 pt-6">
          <div className="rounded-lg bg-emerald-100 p-3">
            <Scale className="h-6 w-6 text-emerald-700" />
          </div>
          <div>
            <p className="text-sm text-emerald-800">
              Filing profit (no POS cash) · FY {summary.fyLabel}
            </p>
            <p className="text-3xl font-bold text-slate-900">
              {formatCurrency(summary.profitIncGst)}
            </p>
            <p className="text-sm text-slate-600">
              Inc GST · {formatCurrency(summary.profitExGst)} ex GST
            </p>
          </div>
          <p className="max-w-md text-sm text-slate-600">
            = Non-cash POS ({formatCurrency(summary.filingRevenueIncGst)}) −
            expenses ({formatCurrency(summary.expensesIncGst)}).
          </p>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50/40">
        <CardContent className="flex flex-wrap items-center gap-6 pt-6">
          <div className="rounded-lg bg-amber-100 p-3">
            <Banknote className="h-6 w-6 text-amber-700" />
          </div>
          <div>
            <p className="text-sm text-amber-900">
              Full profit (includes POS cash) · FY {summary.fyLabel}
            </p>
            <p className="text-3xl font-bold text-slate-900">
              {formatCurrency(summary.profitWithCashIncGst)}
            </p>
            <p className="text-sm text-slate-600">
              Inc GST · {formatCurrency(summary.profitWithCashExGst)} ex GST
            </p>
          </div>
          <p className="max-w-md text-sm text-slate-600">
            Same expenses, but adds POS cash revenue (
            {formatCurrency(summary.cashInPos)}) so you can see the full trading
            picture. Use filing profit above if you are not declaring all cash.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-emerald-100 p-3">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Filing revenue</p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(summary.filingRevenueIncGst)}
              </p>
              <p className="text-xs text-slate-400">
                {summary.filingSaleCount.toLocaleString("en-NZ")} non-cash POS
                orders
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-amber-100 p-3">
              <Banknote className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <p className="text-sm text-slate-500">POS cash (excluded)</p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(summary.cashInPos)}
              </p>
              <p className="text-xs text-slate-400">
                {summary.cashInPosOrders.toLocaleString("en-NZ")} orders · not
                in profit
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
              <p className="text-sm text-slate-500">Business expenses</p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(summary.expensesIncGst)}
              </p>
              <p className="text-xs text-slate-400">
                {summary.expenseCount} lines · excl. personal
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="rounded-lg bg-slate-100 p-3">
              <ClipboardList className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Cash outs (memo)</p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(summary.cashOutNotesTotal)}
              </p>
              <p className="text-xs text-slate-400">
                {summary.cashOutNotesCount} notes · not in profit
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>POS by payment method</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium text-right">Orders</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium text-right">In profit?</th>
                </tr>
              </thead>
              <tbody>
                {summary.revenueByPayment.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-slate-400"
                    >
                      No POS sales in this financial year yet
                    </td>
                  </tr>
                ) : (
                  summary.revenueByPayment.map((row) => (
                    <tr key={row.bucket} className="border-b border-slate-50">
                      <td className="px-4 py-3 text-slate-900">{row.label}</td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {row.orders.toLocaleString("en-NZ")}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {formatCurrency(row.amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {row.inFiling ? "Yes" : "No — memo"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expenses by category</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-slate-500">
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {summary.expensesByCategory.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-6 text-center text-slate-400"
                    >
                      No business expenses in this financial year yet
                    </td>
                  </tr>
                ) : (
                  summary.expensesByCategory.map((row) => (
                    <tr key={row.name} className="border-b border-slate-50">
                      <td className="px-4 py-3 text-slate-900">{row.name}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {formatCurrency(row.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How this profit is calculated</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <p>
            Period: {formatDate(summary.start)} – {formatDate(summary.end)}.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Filing revenue = POS sales{" "}
              <span className="font-medium text-slate-800">excluding Cash</span>{" "}
              ({formatCurrency(summary.filingRevenueIncGst)}).
            </li>
            <li>
              POS cash ({formatCurrency(summary.cashInPos)}) stays visible for
              the accountant but is not in filing profit — you are not declaring
              all cash.
            </li>
            <li>
              Expenses = business costs ({formatCurrency(summary.expensesIncGst)}
              ), excluding Personal drawings
              {summary.personalDrawingsTotal > 0
                ? ` (${formatCurrency(summary.personalDrawingsTotal)} separate)`
                : ""}
              .
            </li>
            <li>
              Cash-out notes ({formatCurrency(summary.cashOutNotesTotal)}) are
              memos only.
            </li>
          </ul>
          <p>
            See also{" "}
            <Link
              href="/reports/gst"
              className="font-medium text-emerald-700 hover:underline"
            >
              GST / Tax
            </Link>{" "}
            and{" "}
            <Link
              href="/payments"
              className="font-medium text-emerald-700 hover:underline"
            >
              Payments · cash outs
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
