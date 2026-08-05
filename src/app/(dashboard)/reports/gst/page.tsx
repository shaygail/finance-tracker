import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { formatCurrency } from "@/lib/utils";
import { getFinancialYearRange } from "@/lib/gst/nz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet } from "lucide-react";

const FY_LABEL = "2025/26";

export default async function GstReportPage() {
  const businessId = await getBusinessId();
  const { start, end } = getFinancialYearRange(FY_LABEL);

  const [transactions, business] = await Promise.all([
    db.transaction.findMany({
      where: {
        businessId,
        date: { gte: start, lte: end },
      },
      include: { category: true },
      orderBy: { date: "asc" },
    }),
    db.business.findUnique({ where: { id: businessId } }),
  ]);

  const expenses = transactions.filter((t) => t.type === "expense");
  const income = transactions.filter((t) => t.type === "income");

  const gstOnExpenses = expenses.reduce((sum, t) => sum + t.gstAmount, 0);
  const gstOnIncome = income.reduce((sum, t) => sum + t.gstAmount, 0);
  const totalExGst = transactions.reduce((sum, t) => sum + t.amountExGst, 0);
  const totalIncGst = transactions.reduce((sum, t) => sum + t.amountIncGst, 0);
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
          {start.toLocaleDateString("en-NZ")} to {end.toLocaleDateString("en-NZ")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Total Ex GST</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(totalExGst)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">GST on Expenses</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(gstOnExpenses)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">GST on Income</p>
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
      </div>

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
            <tfoot>
              <tr className="bg-slate-50 font-medium">
                <td className="px-6 py-3 text-slate-900">Total</td>
                <td className="px-6 py-3 text-right text-slate-600">{expenses.length}</td>
                <td className="px-6 py-3 text-right text-slate-900">
                  {formatCurrency(expenses.reduce((s, t) => s + t.amountExGst, 0))}
                </td>
                <td className="px-6 py-3 text-right text-slate-900">
                  {formatCurrency(gstOnExpenses)}
                </td>
                <td className="px-6 py-3 text-right text-slate-900">
                  {formatCurrency(totalIncGst)}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-slate-500">
            GST Number: {business?.gstNumber ?? "Not set"} · Filing:{" "}
            {business?.gstFilingFrequency?.replace("_", " ") ?? "two monthly"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
