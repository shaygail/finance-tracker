import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function TransactionsPage() {
  const businessId = await getBusinessId();

  const transactions = await db.transaction.findMany({
    where: { businessId },
    include: { category: true },
    orderBy: { date: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
          <p className="text-slate-500">{transactions.length} records</p>
        </div>
        <Link href="/transactions/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            New Transaction
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Vendor</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">Payment</th>
                <th className="px-6 py-3 font-medium text-right">Ex GST</th>
                <th className="px-6 py-3 font-medium text-right">GST</th>
                <th className="px-6 py-3 font-medium text-right">Total</th>
                <th className="px-6 py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-6 py-3 text-slate-600">{formatDate(t.date)}</td>
                  <td className="px-6 py-3 font-medium text-slate-900">{t.vendor}</td>
                  <td className="px-6 py-3">
                    {t.category ? (
                      <Badge variant="muted">{t.category.name}</Badge>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-slate-600">{t.paymentMode}</td>
                  <td className="px-6 py-3 text-right text-slate-600">
                    {formatCurrency(t.amountExGst)}
                  </td>
                  <td className="px-6 py-3 text-right text-slate-600">
                    {formatCurrency(t.gstAmount)}
                  </td>
                  <td className="px-6 py-3 text-right font-medium text-slate-900">
                    {formatCurrency(t.totalAmount)}
                  </td>
                  <td className="px-6 py-3">
                    <Badge variant={t.source === "import" ? "default" : "muted"}>
                      {t.source}
                    </Badge>
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
