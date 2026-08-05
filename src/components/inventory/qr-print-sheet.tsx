"use client";

import { QrDisplay } from "@/components/inventory/qr-display";

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  qrCode: string;
}

export function QrPrintSheet({ ingredients }: { ingredients: Ingredient[] }) {
  return (
    <div className="grid grid-cols-2 gap-6 p-4 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3 print:gap-4">
      {ingredients.map((ing) => (
        <div
          key={ing.id}
          className="flex flex-col items-center rounded-lg border border-slate-200 p-4 text-center print:break-inside-avoid"
        >
          <QrDisplay value={ing.qrCode} label={ing.qrCode} size={120} />
          <p className="mt-3 text-lg font-bold text-slate-900">{ing.name}</p>
          <p className="text-sm text-slate-500">{ing.unit}</p>
          <p className="mt-1 font-mono text-xs text-slate-400">{ing.qrCode}</p>
        </div>
      ))}
    </div>
  );
}
