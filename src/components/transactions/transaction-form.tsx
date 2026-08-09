"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { calculateGstFromInc } from "@/lib/gst/nz";
import { formatCurrency } from "@/lib/utils";
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from "@/app/(dashboard)/transactions/actions";

export type TransactionFormValues = {
  id?: string;
  date: string;
  vendor: string;
  unitAmount: string;
  quantity: string;
  paymentMode: string;
  categoryId: string;
  notes: string;
};

interface TransactionFormProps {
  categories: Array<{ id: string; name: string }>;
  paymentModes: string[];
  mode: "create" | "edit";
  initial?: TransactionFormValues;
}

export function TransactionForm({
  categories,
  paymentModes,
  mode,
  initial,
}: TransactionFormProps) {
  const router = useRouter();
  const [unitAmount, setUnitAmount] = useState(initial?.unitAmount ?? "");
  const [quantity, setQuantity] = useState(initial?.quantity ?? "1");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const totals = useMemo(() => {
    const unit = parseFloat(unitAmount) || 0;
    const qty = parseFloat(quantity) || 1;
    const total = Math.round(unit * qty * 100) / 100;
    return calculateGstFromInc(total);
  }, [unitAmount, quantity]);

  const today = new Date().toISOString().split("T")[0];

  function handleResult(result: { error?: string; href?: string } | undefined) {
    if (result?.error) {
      setError(result.error);
      return;
    }
    setError(null);
    router.push(result?.href ?? "/transactions");
    router.refresh();
  }

  return (
    <form
      className="space-y-4"
      action={(formData) => {
        startTransition(async () => {
          const result =
            mode === "create"
              ? await createTransaction(formData)
              : await updateTransaction(formData);
          handleResult(result);
        });
      }}
    >
      {mode === "edit" && initial?.id && (
        <input type="hidden" name="id" value={initial.id} />
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            name="date"
            type="date"
            defaultValue={initial?.date ?? today}
            required
          />
        </div>
        <div>
          <Label htmlFor="vendor">Vendor / Purchases</Label>
          <Input
            id="vendor"
            name="vendor"
            placeholder="e.g. Pak'nSave"
            defaultValue={initial?.vendor}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="unitAmount">Unit Amount (inc GST)</Label>
          <Input
            id="unitAmount"
            name="unitAmount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={unitAmount}
            onChange={(e) => setUnitAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            step="0.01"
            min="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="paymentMode">Mode of Payment</Label>
          <Select
            id="paymentMode"
            name="paymentMode"
            defaultValue={initial?.paymentMode || paymentModes[0]}
            required
          >
            {paymentModes.map((modeOption) => (
              <option key={modeOption} value={modeOption}>
                {modeOption}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="categoryId">Category</Label>
          <Select
            id="categoryId"
            name="categoryId"
            defaultValue={initial?.categoryId ?? ""}
          >
            <option value="">
              {mode === "create" ? "Auto-detect from vendor" : "Uncategorised"}
            </option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input
          id="notes"
          name="notes"
          placeholder="Additional details"
          defaultValue={initial?.notes}
        />
      </div>

      <div className="rounded-lg bg-slate-50 p-4">
        <p className="mb-2 text-sm font-medium text-slate-700">GST Summary (15%)</p>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-500">Ex GST</p>
            <p className="font-semibold text-slate-900">{formatCurrency(totals.amountExGst)}</p>
          </div>
          <div>
            <p className="text-slate-500">GST</p>
            <p className="font-semibold text-slate-900">{formatCurrency(totals.gstAmount)}</p>
          </div>
          <div>
            <p className="text-slate-500">Total</p>
            <p className="font-semibold text-emerald-700">{formatCurrency(totals.amountIncGst)}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving..."
            : mode === "create"
              ? "Save Transaction"
              : "Save changes"}
        </Button>

        {mode === "edit" && initial?.id && (
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              if (!confirm("Delete this transaction?")) return;
              const fd = new FormData();
              fd.set("id", initial.id!);
              startTransition(async () => {
                handleResult(await deleteTransaction(fd));
              });
            }}
          >
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
