import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

export default async function ProductsPage() {
  const businessId = await getBusinessId();

  const products = await db.product.findMany({
    where: { businessId },
    orderBy: { unitsSold: "desc" },
  });

  const totalRevenue = products.reduce((sum, p) => sum + p.revenue, 0);
  const totalCogs = products.reduce((sum, p) => sum + p.cogs, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Products</h1>
        <p className="text-slate-500">Best sellers and revenue performance</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Total Revenue</p>
            <p className="text-2xl font-bold text-emerald-700">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Total COGS</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalCogs)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Gross Margin</p>
            <p className="text-2xl font-bold text-slate-900">
              {totalRevenue > 0
                ? `${(((totalRevenue - totalCogs) / totalRevenue) * 100).toFixed(1)}%`
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            Best Sellers
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
                <th className="px-6 py-3 font-medium">#</th>
                <th className="px-6 py-3 font-medium">Product</th>
                <th className="px-6 py-3 font-medium">SKU</th>
                <th className="px-6 py-3 font-medium text-right">Units Sold</th>
                <th className="px-6 py-3 font-medium text-right">Revenue</th>
                <th className="px-6 py-3 font-medium text-right">COGS</th>
                <th className="px-6 py-3 font-medium text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => {
                const margin = p.revenue > 0 ? ((p.revenue - p.cogs) / p.revenue) * 100 : 0;
                return (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-6 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-6 py-3 font-medium text-slate-900">{p.name}</td>
                    <td className="px-6 py-3 text-slate-500">{p.sku ?? "—"}</td>
                    <td className="px-6 py-3 text-right text-slate-600">{p.unitsSold}</td>
                    <td className="px-6 py-3 text-right font-medium text-slate-900">
                      {formatCurrency(p.revenue)}
                    </td>
                    <td className="px-6 py-3 text-right text-slate-600">
                      {formatCurrency(p.cogs)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Badge variant={margin >= 50 ? "success" : margin >= 30 ? "default" : "warning"}>
                        {margin.toFixed(0)}%
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
