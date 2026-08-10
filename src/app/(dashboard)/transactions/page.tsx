import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { formatCurrency, formatDateUtc } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CategoryFilter } from "@/components/transactions/category-filter";
import { Download, Pencil, Plus } from "lucide-react";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string }>;
}) {
  const businessId = await getBusinessId();
  const { categoryId: rawCategoryId } = await searchParams;
  const categoryId = rawCategoryId?.trim() || "";

  const where =
    categoryId === "uncategorised"
      ? { businessId, categoryId: null }
      : categoryId
        ? { businessId, categoryId }
        : { businessId };

  const [categories, business, transactions] = await Promise.all([
    db.category.findMany({
      where: { businessId, type: "expense" },
      orderBy: { name: "asc" },
    }),
    db.business.findUnique({
      where: { id: businessId },
      select: { gstRegistered: true },
    }),
    db.transaction.findMany({
      where,
      include: { category: true },
      orderBy: { date: "desc" },
    }),
  ]);

  const gstRegistered = business?.gstRegistered ?? false;

  const selectedCategory =
    categoryId && categoryId !== "uncategorised"
      ? categories.find((c) => c.id === categoryId)
      : null;

  const newHref =
    selectedCategory
      ? `/transactions/new?categoryId=${selectedCategory.id}`
      : "/transactions/new";

  const exportHref = categoryId
    ? `/api/transactions/export?categoryId=${encodeURIComponent(categoryId)}`
    : "/api/transactions/export";

  const title =
    categoryId === "uncategorised"
      ? "Uncategorised"
      : selectedCategory
        ? selectedCategory.name
        : "All Transactions";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
          <p className="text-slate-500">
            {transactions.length} records
            {selectedCategory ? ` in ${selectedCategory.name}` : ""}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <CategoryFilter categories={categories} selectedId={categoryId} />
          <a href={exportHref} className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Download CSV
            </Button>
          </a>
          <Link href={newHref} className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              New Transaction
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {transactions.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-400">
              No transactions in this view — add one or clear the category filter
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Vendor</th>
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-6 py-3 font-medium">Payment</th>
                  {gstRegistered && (
                    <>
                      <th className="px-6 py-3 font-medium text-right">Ex GST</th>
                      <th className="px-6 py-3 font-medium text-right">GST</th>
                    </>
                  )}
                  <th className="px-6 py-3 font-medium text-right">Total</th>
                  <th className="px-6 py-3 font-medium">Source</th>
                  <th className="px-6 py-3 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-6 py-3 text-slate-600">{formatDateUtc(t.date)}</td>
                    <td className="px-6 py-3 font-medium text-slate-900">{t.vendor}</td>
                    <td className="px-6 py-3">
                      {t.category ? (
                        <Badge variant="muted">{t.category.name}</Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-600">{t.paymentMode}</td>
                    {gstRegistered && (
                      <>
                        <td className="px-6 py-3 text-right text-slate-600">
                          {formatCurrency(t.amountExGst)}
                        </td>
                        <td className="px-6 py-3 text-right text-slate-600">
                          {formatCurrency(t.gstAmount)}
                        </td>
                      </>
                    )}
                    <td className="px-6 py-3 text-right font-medium text-slate-900">
                      {formatCurrency(t.totalAmount)}
                    </td>
                    <td className="px-6 py-3">
                      <Badge variant={t.source === "import" ? "default" : "muted"}>
                        {t.source}
                      </Badge>
                    </td>
                    <td className="px-6 py-3">
                      <Link
                        href={`/transactions/${t.id}/edit`}
                        className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Link>
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
