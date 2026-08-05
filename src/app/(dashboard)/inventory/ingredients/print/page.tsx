import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { QrPrintSheet } from "@/components/inventory/qr-print-sheet";
import Link from "next/link";
import { PrintButton } from "@/components/inventory/print-button";
import { ArrowLeft } from "lucide-react";

export default async function PrintQrLabelsPage() {
  const businessId = await getBusinessId();

  const ingredients = await db.ingredient.findMany({
    where: { businessId },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <Link
            href="/inventory/ingredients"
            className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to ingredients
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Print QR Labels</h1>
          <p className="text-slate-500">
            Print and stick on ingredient containers for quick stock counts
          </p>
        </div>
        <PrintButton />
      </div>

      <QrPrintSheet ingredients={ingredients} />
    </div>
  );
}
