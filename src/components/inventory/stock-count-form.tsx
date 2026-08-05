"use client";

import { useState } from "react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateStockCount } from "@/app/(dashboard)/inventory/actions";

interface StockCountFormProps {
  ingredientId: string;
  ingredientName: string;
  currentStock: number;
  unit: string;
}

export function StockCountForm({
  ingredientId,
  ingredientName,
  currentStock,
  unit,
}: StockCountFormProps) {
  const [quantity, setQuantity] = useState(String(currentStock));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);

    const formData = new FormData();
    formData.append("ingredientId", ingredientId);
    formData.append("quantity", quantity);

    const result = await updateStockCount(formData);
    setPending(false);

    if (result.error) {
      setMessage(result.error);
    } else {
      setMessage(`Updated ${result.ingredientName} to ${result.quantity} ${unit}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="font-medium text-slate-900">{ingredientName}</p>
      <div>
        <Label htmlFor={`qty-${ingredientId}`}>Stock Count ({unit})</Label>
        <Input
          id={`qty-${ingredientId}`}
          type="number"
          step="0.01"
          min="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving..." : "Update Stock"}
      </Button>
      {message && (
        <p className={`text-sm ${message.startsWith("Updated") ? "text-emerald-600" : "text-red-600"}`}>
          {message}
        </p>
      )}
    </form>
  );
}
