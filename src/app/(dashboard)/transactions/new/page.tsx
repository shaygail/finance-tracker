import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { PAYMENT_MODES, TRANSACTION_TYPES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewTransactionForm } from "@/components/transactions/new-transaction-form";

export default async function NewTransactionPage() {
  const businessId = await getBusinessId();

  const categories = await db.category.findMany({
    where: { businessId },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Transaction</h1>
        <p className="text-slate-500">
          Record income or expenses with GST / tax calculation
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction Details</CardTitle>
        </CardHeader>
        <CardContent>
          <NewTransactionForm
            categories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              type: c.type,
            }))}
            paymentModes={[...PAYMENT_MODES]}
            transactionTypes={[...TRANSACTION_TYPES]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
