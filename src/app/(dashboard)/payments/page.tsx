import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getSalesByPaymentMethod } from "@/lib/sales/payments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PaymentMethodBarChart,
  PaymentMethodPieChart,
} from "@/components/dashboard/charts";
import { CashTakingForm } from "@/components/payments/cash-taking-form";
import { DeleteCashTakingButton } from "@/components/payments/delete-cash-taking-button";
import {
  CashOutNoteForm,
  DeleteCashOutNoteButton,
} from "@/components/payments/cash-out-note-form";
import { Banknote, ClipboardList, CreditCard } from "lucide-react";

export default async function PaymentsPage() {
  const businessId = await getBusinessId();

  const [payments, cashEntries, cashOutNotes] = await Promise.all([
    getSalesByPaymentMethod(businessId),
    db.sale.findMany({
      where: { businessId, source: "cash_manual" },
      orderBy: { soldAt: "desc" },
      take: 30,
    }),
    db.cashOutNote.findMany({
      where: { businessId },
      orderBy: { date: "desc" },
      take: 50,
    }),
  ]);

  const chartData = payments.byMethod.map((m) => ({
    name: m.label,
    revenue: Math.round(m.revenue * 100) / 100,
    orders: m.orders,
  }));

  const cashRow = payments.byMethod.find((m) => m.bucket === "cash");
  const cashOutTotal = cashOutNotes.reduce((s, n) => s + n.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
        <p className="text-slate-500">
          How customers pay — from POS sync. Cash rung up in the POS already counts
          in revenue; do not enter it again here.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Total sales revenue</p>
            <p className="text-2xl font-bold text-slate-900">
              {formatCurrency(payments.totalRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Orders</p>
            <p className="text-2xl font-bold text-slate-900">
              {payments.totalOrders.toLocaleString("en-NZ")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Highest by revenue</p>
            <p className="text-2xl font-bold text-slate-900">
              {payments.topMethod?.label ?? "—"}
            </p>
            {payments.topMethod && (
              <p className="text-sm text-slate-500">
                {formatCurrency(payments.topMethod.revenue)} ·{" "}
                {payments.topMethod.share.toFixed(0)}%
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Cash (from POS)</p>
            <p className="text-2xl font-bold text-slate-900">
              {formatCurrency(cashRow?.revenue ?? 0)}
            </p>
            <p className="text-sm text-slate-500">
              {(cashRow?.orders ?? 0).toLocaleString("en-NZ")} entries
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-teal-700" />
              Revenue by payment method
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentMethodBarChart data={chartData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Share of revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentMethodPieChart data={chartData} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment method detail</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium text-right">Orders</th>
                <th className="px-4 py-3 font-medium text-right">Revenue</th>
                <th className="px-4 py-3 font-medium text-right">Avg order</th>
                <th className="px-4 py-3 font-medium text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {payments.byMethod.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No sales yet — sync POS or add cash below
                  </td>
                </tr>
              ) : (
                payments.byMethod.map((row) => (
                  <tr key={row.bucket} className="border-b border-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {row.label}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {row.orders.toLocaleString("en-NZ")}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900">
                      {formatCurrency(row.revenue)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {formatCurrency(row.avgOrderValue)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {row.share.toFixed(1)}%
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
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-slate-700" />
            Cash outs (accountant file)
          </CardTitle>
          <p className="text-sm font-normal text-slate-500">
            Log cash taken out or held from sales that are <span className="font-medium text-slate-700">already in POS</span>.
            This is a note for the accountant only — it does not change revenue or expenses.
          </p>
          {cashOutNotes.length > 0 && (
            <p className="text-sm text-slate-600">
              Listed total: {formatCurrency(cashOutTotal)}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <CashOutNoteForm />
          {cashOutNotes.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
              {cashOutNotes.map((n) => (
                <li
                  key={n.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {formatCurrency(n.amount)} · {formatDate(n.date)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {n.label || "Cash out"}
                      {n.notes ? ` — ${n.notes}` : ""}
                    </p>
                  </div>
                  <DeleteCashOutNoteButton id={n.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-amber-700" />
            Cash not in POS (rare)
          </CardTitle>
          <p className="text-sm font-normal text-slate-500">
            Only use this if cash sales were <span className="font-medium text-slate-700">never rung up in the POS</span>.
            Cash that is already in POS must not be added here — that would double-count revenue.
            Prefer <span className="font-medium text-slate-700">Cash outs</span> above for till cash already in POS.
          </p>
        </CardHeader>
        <CardContent>
          <CashTakingForm />
        </CardContent>
      </Card>

      {cashEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Manual cash entries</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100">
              {cashEntries.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {s.customerName || "Cash taking"} · {formatDate(s.soldAt)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatCurrency(s.totalAmount)}
                    </p>
                  </div>
                  <DeleteCashTakingButton saleId={s.id} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
