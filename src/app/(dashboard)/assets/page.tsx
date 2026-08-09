import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { formatCurrency, formatDateUtc } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssetRegistryUploader } from "@/components/assets/asset-registry-uploader";
import { Archive } from "lucide-react";

export default async function AssetsPage() {
  const businessId = await getBusinessId();

  const assets = await db.asset.findMany({
    where: { businessId },
    orderBy: [{ datePurchased: "desc" }, { name: "asc" }],
  });

  const totalValue = assets.reduce((s, a) => s + a.totalCost, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Asset Registry</h1>
        <p className="text-slate-500">
          {assets.length} assets · {formatCurrency(totalValue)} total cost
        </p>
      </div>

      <AssetRegistryUploader />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Assets on register</p>
            <p className="text-2xl font-bold text-slate-900">{assets.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Registered value</p>
            <p className="text-2xl font-bold text-emerald-700">
              {formatCurrency(totalValue)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-emerald-600" />
            Register
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {assets.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-400">
              No assets yet — upload the Asset Registry CSV above
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Brand / Model</th>
                  <th className="px-4 py-3 font-medium">Purchased</th>
                  <th className="px-4 py-3 font-medium text-right">Qty</th>
                  <th className="px-4 py-3 font-medium text-right">Unit</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{a.name}</p>
                      {a.description && (
                        <p className="text-xs text-slate-500">{a.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{a.location ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {[a.brand, a.model].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDateUtc(a.datePurchased)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{a.quantity}</td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {formatCurrency(a.unitCost)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {formatCurrency(a.totalCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
