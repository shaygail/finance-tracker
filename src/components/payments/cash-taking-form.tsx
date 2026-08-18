"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { addCashTaking } from "@/app/(dashboard)/payments/actions";

function todayInputValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function CashTakingForm() {
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
      const result = await addCashTaking(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess("Cash taking saved");
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
          <Label htmlFor="amount">Cash amount (inc GST)</Label>
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
        <Label htmlFor="label">Label (optional)</Label>
        <Input
          id="label"
          name="label"
          placeholder="e.g. Saturday stall float count"
        />
      </div>
      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input
          id="notes"
          name="notes"
          placeholder="e.g. counted till after market"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add cash taking"}
      </Button>
    </form>
  );
}
