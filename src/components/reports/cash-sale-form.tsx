"use client";

import { useRef, useState, useTransition } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addCashSale, deleteCashSale } from "@/app/(dashboard)/reports/gst/actions";

export function CashSaleForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form
      ref={formRef}
      className="grid gap-4 sm:grid-cols-2"
      action={(formData) => {
        startTransition(async () => {
          const result = await addCashSale(formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          setError(null);
          formRef.current?.reset();
        });
      }}
    >
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
          {error}
        </p>
      )}
      <div>
        <Label htmlFor="soldAt">Date</Label>
        <Input id="soldAt" name="soldAt" type="date" defaultValue={today} required />
      </div>
      <div>
        <Label htmlFor="totalAmount">Cash total (inc GST)</Label>
        <Input
          id="totalAmount"
          name="totalAmount"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          required
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="notes">Note (optional)</Label>
        <Input id="notes" name="notes" placeholder="e.g. Saturday market cash float" />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add cash not in POS"}
        </Button>
      </div>
    </form>
  );
}

export function DeleteCashSaleButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm("Delete this cash sale?")) return;
        const fd = new FormData();
        fd.set("id", id);
        startTransition(async () => {
          await deleteCashSale(fd);
        });
      }}
    >
      {pending ? "…" : "Delete"}
    </Button>
  );
}
