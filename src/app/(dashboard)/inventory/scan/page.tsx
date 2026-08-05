import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { QrScanner } from "@/components/inventory/qr-scanner";

export default async function ScanPage() {
  const businessId = await getBusinessId();

  const ingredients = await db.ingredient.findMany({
    where: { businessId },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Scan QR Code</h1>
        <p className="text-slate-500">Scan ingredient labels to update stock counts</p>
      </div>

      <QrScanner
        ingredients={ingredients.map((i) => ({
          id: i.id,
          name: i.name,
          qrCode: i.qrCode,
          currentStock: i.currentStock,
          unit: i.unit,
        }))}
      />
    </div>
  );
}
