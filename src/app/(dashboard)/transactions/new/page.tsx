import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { PAYMENT_MODES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewTransactionForm } from "@/components/transactions/new-transaction-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string }>;
}) {
  const businessId = await getBusinessId();
  const { categoryId } = await searchParams;

  const categories = await db.category.findMany({
    where: { businessId, type: "expense" },
    orderBy: { name: "asc" },
  });

  const defaultCategoryId =
    categoryId && categories.some((c) => c.id === categoryId) ? categoryId : "";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={defaultCategoryId ? `/transactions?categoryId=${defaultCategoryId}` : "/transactions"}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-emerald-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to transactions
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Transaction</h1>
        <p className="text-slate-500">Record a manual expense with GST calculation</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction Details</CardTitle>
        </CardHeader>
        <CardContent>
          <NewTransactionForm
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
            paymentModes={[...PAYMENT_MODES]}
            defaultCategoryId={defaultCategoryId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
