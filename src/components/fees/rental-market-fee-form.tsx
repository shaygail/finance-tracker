"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { addRentalMarketFee } from "@/app/(dashboard)/fees/actions";

function todayInputValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RentalMarketFeeForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await addRentalMarketFee(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess("Fee saved");
      form.reset();
      const dateInput = form.elements.namedItem("date") as HTMLInputElement | null;
      if (dateInput) dateInput.value = todayInputValue();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={todayInputValue()}
          />
        </div>
        <div>
          <Label htmlFor="amount">Amount (inc GST unless marked GST-free)</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="0.00"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="vendor">Paid to</Label>
        <Input
          id="vendor"
          name="vendor"
          required
          placeholder="e.g. Stratford Makers Market, Tina Koch (stall)"
        />
      </div>
      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input
          id="notes"
          name="notes"
          placeholder="e.g. Aug 2 stall · Saturday pitch"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="gstFree" className="rounded border-slate-300" />
        GST-free (no GST on this fee)
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add rental / market fee"}
      </Button>
    </form>
  );
}
