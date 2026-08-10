import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { PAYMENT_MODES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { ArrowLeft } from "lucide-react";

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const businessId = await getBusinessId();
  const { id } = await params;

  const [transaction, categories, business] = await Promise.all([
    db.transaction.findFirst({
      where: { id, businessId },
    }),
    db.category.findMany({
      where: { businessId, type: "expense" },
      orderBy: { name: "asc" },
    }),
    db.business.findUnique({
      where: { id: businessId },
      select: { gstRegistered: true },
    }),
  ]);

  if (!transaction) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/transactions"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-emerald-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to transactions
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Edit Transaction</h1>
        <p className="text-slate-500">Update details, category, or delete this record</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction Details</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionForm
            mode="edit"
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
            paymentModes={[...PAYMENT_MODES]}
            gstRegistered={business?.gstRegistered ?? false}
            initial={{
              id: transaction.id,
              date: toDateInputValue(transaction.date),
              vendor: transaction.vendor,
              unitAmount: String(transaction.unitAmount),
              quantity: String(transaction.quantity),
              paymentMode: transaction.paymentMode,
              categoryId: transaction.categoryId ?? "",
              notes: transaction.notes ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
