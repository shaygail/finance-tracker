"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  addCashOutNote,
  deleteCashOutNote,
} from "@/app/(dashboard)/payments/cash-out-actions";

function todayInputValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function CashOutNoteForm() {
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
      const result = await addCashOutNote(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess("Cash out recorded for the accountant");
      form.reset();
      const dateInput = form.elements.namedItem("date") as HTMLInputElement | null;
      if (dateInput) dateInput.value = todayInputValue();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="cashout-date">Date</Label>
          <Input
            id="cashout-date"
            name="date"
            type="date"
            required
            defaultValue={todayInputValue()}
          />
        </div>
        <div>
          <Label htmlFor="cashout-amount">Cash out amount</Label>
          <Input
            id="cashout-amount"
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
        <Label htmlFor="cashout-label">What (optional)</Label>
        <Input
          id="cashout-label"
          name="label"
          placeholder="e.g. Siomai & chilli oil cash"
        />
      </div>
      <div>
        <Label htmlFor="cashout-notes">Notes for accountant (optional)</Label>
        <Input
          id="cashout-notes"
          name="notes"
          placeholder="e.g. Already in POS — cash held / taken out"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Record cash out"}
      </Button>
    </form>
  );
}

export function DeleteCashOutNoteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this cash-out note?")) return;
        startTransition(async () => {
          await deleteCashOutNote(id);
        });
      }}
    >
      {pending ? "…" : "Delete"}
    </Button>
  );
}
