import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { formatCurrency, formatDate, formatDateUtc } from "@/lib/utils";
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
  CashSaleForm,
  DeleteCashSaleButton,
} from "@/components/reports/cash-sale-form";
import {
  Banknote,
  Calendar,
  FileSpreadsheet,
  Receipt,
  Scale,
} from "lucide-react";
import Link from "next/link";

export default async function GstReportPage() {
  const businessId = await getBusinessId();
  const { start, end, label: fyLabel } = getCurrentFinancialYearRange();

  const [transactions, sales, business] = await Promise.all([
    db.transaction.findMany({
      where: { businessId, date: { gte: start, lte: end } },
      include: { category: true },
      orderBy: { date: "asc" },
    }),
    db.sale.findMany({
      where: { businessId, soldAt: { gte: start, lte: end } },
      orderBy: { soldAt: "desc" },
    }),
    db.business.findUnique({ where: { id: businessId } }),
  ]);

  const frequency = (business?.gstFilingFrequency ?? "two_monthly") as GstFilingFrequency;
  const gstRegistered = business?.gstRegistered ?? false;

  if (!gstRegistered) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">GST / Tax</h1>
          <p className="text-slate-500">{business?.name}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-slate-500" />
              Not GST registered
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <p>
              Tax-to-pay and filing periods stay off until you mark the business as GST
              registered. You can still track sales and expenses as normal totals.
            </p>
            <p>
              When IRD confirms your registration, turn it on in{" "}
              <Link href="/settings" className="font-medium text-emerald-700 hover:underline">
                Settings → GST registration
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const posSales = sales.filter((s) => s.source !== "cash");
  const cashSales = sales.filter((s) => s.source === "cash");

  const posRevenue = round2(posSales.reduce((s, x) => s + x.totalAmount, 0));
  const cashRevenue = round2(cashSales.reduce((s, x) => s + x.totalAmount, 0));
  const totalRevenue = round2(posRevenue + cashRevenue);

  const gstFromPos = round2(posSales.reduce((s, x) => s + x.gstAmount, 0));
  const gstFromCash = round2(cashSales.reduce((s, x) => s + x.gstAmount, 0));
  const gstOnIncomeFromTx = round2(
    transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.gstAmount, 0)
  );
  const gstOnIncome = round2(gstFromPos + gstFromCash + gstOnIncomeFromTx);

  const expenses = transactions.filter((t) => t.type === "expense" || t.type === "refund");
  const gstOnExpenses = round2(expenses.reduce((sum, t) => sum + t.gstAmount, 0));
  const expenseTotal = round2(expenses.reduce((sum, t) => sum + t.totalAmount, 0));
  const netGst = round2(gstOnIncome - gstOnExpenses);

  const combinedForPeriods = [
    ...transactions.map((t) => ({
      date: t.date,
      type: t.type,
      gstAmount: t.gstAmount,
    })),
    ...sales.map((s) => ({
      date: s.soldAt,
      type: "sale" as const,
      gstAmount: s.gstAmount,
    })),
  ];

  const periodSummaries = summariseGstPeriods(combinedForPeriods, fyLabel, frequency);
  const currentPeriod =
    getPeriodForDate(new Date(), fyLabel, frequency) ??
    periodSummaries.find((p) => !p.isOverdue)?.period ??
    periodSummaries[periodSummaries.length - 1]?.period;
  const currentSummary = periodSummaries.find((s) => s.period.id === currentPeriod?.id);

  const byCategory = expenses.reduce(
    (acc, t) => {
      const name = t.category?.name ?? "Uncategorised";
      if (!acc[name]) acc[name] = { exGst: 0, gst: 0, incGst: 0, count: 0 };
      acc[name].exGst += t.amountExGst;
      acc[name].gst += t.gstAmount;
      acc[name].incGst += t.amountIncGst;
      acc[name].count += 1;
      return acc;
    },
    {} as Record<string, { exGst: number; gst: number; incGst: number; count: number }>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">GST / Tax to pay</h1>
        <p className="text-slate-500">
          Financial Year {fyLabel} — {business?.name}
        </p>
        <p className="text-sm text-slate-400">
          Output GST comes from recorded revenue (POS + any cash you enter). Input GST comes from
          expense transactions. Preparation only — verify with your accountant before filing in
          myIR.
        </p>
      </div>

      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-emerald-100 p-3">
              <Scale className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-900">
                {currentSummary
                  ? `GST to pay — ${currentSummary.period.label}`
                  : "GST to pay — this financial year"}
              </p>
              <p
                className={`text-3xl font-bold ${
                  (currentSummary?.netGst ?? netGst) >= 0 ? "text-red-700" : "text-emerald-700"
                }`}
              >
                {formatCurrency(Math.abs(currentSummary?.netGst ?? netGst))}
                {(currentSummary?.netGst ?? netGst) < 0 ? " refund" : ""}
              </p>
              {currentSummary && (
                <p className="mt-1 text-sm text-slate-600">
                  Due {formatDate(currentSummary.period.dueDate)} · Output{" "}
                  {formatCurrency(currentSummary.gstOnIncome)} − Input{" "}
                  {formatCurrency(currentSummary.gstOnExpenses)}
                </p>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-600">
            <p>
              FY net:{" "}
              <span className="font-semibold text-slate-900">
                {formatCurrency(Math.abs(netGst))}
                {netGst < 0 ? " refund" : " payable"}
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Cash not entered here is not included in tax — add only the cash totals you want
              tracked.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Recorded revenue (inc GST)</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</p>
            <p className="mt-1 text-xs text-slate-400">
              POS {formatCurrency(posRevenue)} · Cash {formatCurrency(cashRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Output GST (on revenue)</p>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(gstOnIncome)}</p>
            <p className="mt-1 text-xs text-slate-400">
              POS {formatCurrency(gstFromPos)} · Cash {formatCurrency(gstFromCash)}
              {gstOnIncomeFromTx > 0 ? ` · Other ${formatCurrency(gstOnIncomeFromTx)}` : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Input GST (expenses)</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(gstOnExpenses)}</p>
            <p className="mt-1 text-xs text-slate-400">
              From {formatCurrency(expenseTotal)} expenses ·{" "}
              <Link href="/transactions" className="text-emerald-700 hover:underline">
                manage
              </Link>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">FY net GST</p>
            <p className={`text-xl font-bold ${netGst >= 0 ? "text-red-600" : "text-emerald-600"}`}>
              {formatCurrency(Math.abs(netGst))}
              {netGst < 0 ? " refund" : " payable"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              GST# {business?.gstNumber ?? "Not set"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-emerald-600" />
            Add cash sale (optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-slate-500">
            POS card/EFTPOS sales are already included from sync. Add only the cash takings you
            want in the GST calculation — you do not need to enter every cash sale.
          </p>
          <CashSaleForm />

          {cashSales.length > 0 && (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
              {cashSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {formatCurrency(sale.totalAmount)}{" "}
                      <span className="font-normal text-slate-500">
                        · GST {formatCurrency(sale.gstAmount)}
                      </span>
                    </p>
                    <p className="text-slate-500">
                      {formatDateUtc(sale.soldAt)}
                      {sale.customerName ? ` · ${sale.customerName}` : ""}
                    </p>
                  </div>
                  <DeleteCashSaleButton id={sale.id} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-emerald-600" />
            GST periods — {frequency.replace("_", " ")}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
                <th className="px-6 py-3 font-medium">Period</th>
                <th className="px-6 py-3 font-medium">Due date</th>
                <th className="px-6 py-3 font-medium text-right">Input GST</th>
                <th className="px-6 py-3 font-medium text-right">Output GST</th>
                <th className="px-6 py-3 font-medium text-right">Tax to pay</th>
                <th className="px-6 py-3 font-medium text-right">Entries</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {periodSummaries.map((s) => {
                const isCurrent = s.period.id === currentPeriod?.id;
                return (
                  <tr
                    key={s.period.id}
                    className={`border-b border-slate-50 ${isCurrent ? "bg-emerald-50/60" : ""}`}
                  >
                    <td className="px-6 py-3 font-medium text-slate-900">
                      {s.period.label}
                      {isCurrent && (
                        <Badge variant="success" className="ml-2">
                          Current
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-600">
                      {formatDate(s.period.dueDate)}
                    </td>
                    <td className="px-6 py-3 text-right text-red-600">
                      {formatCurrency(s.gstOnExpenses)}
                    </td>
                    <td className="px-6 py-3 text-right text-emerald-600">
                      {formatCurrency(s.gstOnIncome)}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-slate-900">
                      {formatCurrency(s.netGst)}
                    </td>
                    <td className="px-6 py-3 text-right text-slate-600">{s.transactionCount}</td>
                    <td className="px-6 py-3">
                      {s.isOverdue ? (
                        <Badge variant="warning">Overdue</Badge>
                      ) : s.isDueSoon ? (
                        <Badge variant="warning">Due soon</Badge>
                      ) : (
                        <Badge variant="muted">OK</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-600" />
            How this is calculated
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <p>
            <span className="font-medium text-slate-900">Output GST</span> = 15/115 of recorded
            sales revenue (POS sync + cash you add).
          </p>
          <p>
            <span className="font-medium text-slate-900">Input GST</span> = GST on expense
            transactions you have entered.
          </p>
          <p>
            <span className="font-medium text-slate-900">Tax to pay</span> = Output GST − Input GST.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Expenses by category — FY {fyLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {Object.keys(byCategory).length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-400">
              No expense transactions in this financial year yet
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-6 py-3 font-medium text-right">Transactions</th>
                  <th className="px-6 py-3 font-medium text-right">Ex GST</th>
                  <th className="px-6 py-3 font-medium text-right">GST (15%)</th>
                  <th className="px-6 py-3 font-medium text-right">Inc GST</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(byCategory)
                  .sort(([, a], [, b]) => b.incGst - a.incGst)
                  .map(([name, data]) => (
                    <tr key={name} className="border-b border-slate-50">
                      <td className="px-6 py-3 font-medium text-slate-900">{name}</td>
                      <td className="px-6 py-3 text-right text-slate-600">{data.count}</td>
                      <td className="px-6 py-3 text-right text-slate-600">
                        {formatCurrency(data.exGst)}
                      </td>
                      <td className="px-6 py-3 text-right text-slate-600">
                        {formatCurrency(data.gst)}
                      </td>
                      <td className="px-6 py-3 text-right font-medium text-slate-900">
                        {formatCurrency(data.incGst)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
