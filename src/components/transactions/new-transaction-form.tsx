"use client";

import { TransactionForm } from "./transaction-form";

interface NewTransactionFormProps {
  categories: Array<{ id: string; name: string }>;
  paymentModes: string[];
  defaultCategoryId?: string;
}

export function NewTransactionForm({
  categories,
  paymentModes,
  defaultCategoryId = "",
}: NewTransactionFormProps) {
  return (
    <TransactionForm
      mode="create"
      categories={categories}
      paymentModes={paymentModes}
      initial={{
        date: new Date().toISOString().split("T")[0],
        vendor: "",
        unitAmount: "",
        quantity: "1",
        paymentMode: paymentModes[0] ?? "Cash",
        categoryId: defaultCategoryId,
        notes: "",
      }}
    />
  );
}
