"use client";

import { useMemo, useState } from "react";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { calculateGstFromInc } from "@/lib/gst/nz";
import { formatCurrency } from "@/lib/utils";
import { createTransaction } from "@/app/(dashboard)/transactions/actions";

interface NewTransactionFormProps {
  categories: Array<{ id: string; name: string }>;
  paymentModes: string[];
}

export function NewTransactionForm({ categories, paymentModes }: NewTransactionFormProps) {
  const [unitAmount, setUnitAmount] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [pending, setPending] = useState(false);

  const totals = useMemo(() => {
    const unit = parseFloat(unitAmount) || 0;
    const qty = parseFloat(quantity) || 1;
    const total = Math.round(unit * qty * 100) / 100;
    return calculateGstFromInc(total);
  }, [unitAmount, quantity]);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      await createTransaction(formData);
    } catch {
      setPending(false);
    }
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="date">Date</Label>
          <Input id="date" name="date" type="date" defaultValue={today} required />
        </div>
        <div>
          <Label htmlFor="vendor">Vendor / Purchases</Label>
          <Input id="vendor" name="vendor" placeholder="e.g. Pak'nSave" required />
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
          <Select id="paymentMode" name="paymentMode" defaultValue={paymentModes[0]} required>
            {paymentModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="categoryId">Category</Label>
          <Select id="categoryId" name="categoryId" defaultValue="">
            <option value="">Auto-detect from vendor</option>
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
        <Input id="notes" name="notes" placeholder="Additional details" />
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

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save Transaction"}
        </Button>
      </div>
    </form>
  );
}
