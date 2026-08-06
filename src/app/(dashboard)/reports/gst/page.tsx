import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  getFinancialYearRange,
  summariseGstPeriods,
  type GstFilingFrequency,
} from "@/lib/gst/nz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Calendar } from "lucide-react";

const FY_LABEL = "2025/26";

export default async function GstReportPage() {
  const businessId = await getBusinessId();
  const { start, end } = getFinancialYearRange(FY_LABEL);

  const [transactions, sales, business] = await Promise.all([
    db.transaction.findMany({
      where: { businessId, date: { gte: start, lte: end } },
      include: { category: true },
      orderBy: { date: "asc" },
    }),
    db.sale.findMany({
      where: { businessId, soldAt: { gte: start, lte: end } },
    }),
    db.business.findUnique({ where: { id: businessId } }),
  ]);

  const frequency = (business?.gstFilingFrequency ?? "two_monthly") as GstFilingFrequency;

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

  const periodSummaries = summariseGstPeriods(combinedForPeriods, FY_LABEL, frequency);

  const expenses = transactions.filter((t) => t.type === "expense" || t.type === "refund");
  const gstOnExpenses = expenses.reduce((sum, t) => sum + t.gstAmount, 0);
  const gstOnIncomeFromSales = sales.reduce((sum, s) => sum + s.gstAmount, 0);
  const gstOnIncomeFromTx = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.gstAmount, 0);
  const gstOnIncome = gstOnIncomeFromSales + gstOnIncomeFromTx;
  const netGst = gstOnIncome - gstOnExpenses;

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
        <h1 className="text-2xl font-bold text-slate-900">GST Report</h1>
        <p className="text-slate-500">
          Financial Year {FY_LABEL} — {business?.name}
        </p>
        <p className="text-sm text-slate-400">
          {start.toLocaleDateString("en-NZ")} to {end.toLocaleDateString("en-NZ")} · For
          preparation only — verify with your accountant before filing in myIR
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Input GST (expenses)</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(gstOnExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Output GST (income)</p>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(gstOnIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Net GST Payable</p>
            <p className={`text-xl font-bold ${netGst >= 0 ? "text-red-600" : "text-emerald-600"}`}>
              {formatCurrency(Math.abs(netGst))}
              {netGst < 0 ? " refund" : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">GST Number</p>
            <p className="text-xl font-bold text-slate-900">{business?.gstNumber ?? "Not set"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-emerald-600" />
            GST Periods — {frequency.replace("_", " ")}
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
                <th className="px-6 py-3 font-medium text-right">Net GST</th>
                <th className="px-6 py-3 font-medium text-right">Txns</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {periodSummaries.map((s) => (
                <tr key={s.period.id} className="border-b border-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-900">{s.period.label}</td>
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
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Expenses by Category — FY {FY_LABEL}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
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
        </CardContent>
      </Card>
    </div>
  );
}
