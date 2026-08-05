import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QrDisplay } from "@/components/inventory/qr-display";
import { StockCountForm } from "@/components/inventory/stock-count-form";
import { AlertTriangle } from "lucide-react";

export default async function IngredientsPage() {
  const businessId = await getBusinessId();

  const ingredients = await db.ingredient.findMany({
    where: { businessId },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ingredients</h1>
        <p className="text-slate-500">{ingredients.length} items with QR codes for stock counts</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ingredients.map((ing) => {
          const lowStock = ing.currentStock <= ing.parLevel;
          return (
            <Card key={ing.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{ing.name}</CardTitle>
                  {lowStock && (
                    <Badge variant="warning">
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      Low
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-center">
                  <QrDisplay value={ing.qrCode} label={ing.qrCode} />
                </div>
                <div className="text-center text-sm text-slate-600">
                  <p>
                    Stock: <span className="font-semibold text-slate-900">{ing.currentStock}</span>{" "}
                    {ing.unit}
                  </p>
                  <p className="text-slate-400">Par level: {ing.parLevel} {ing.unit}</p>
                </div>
                <StockCountForm
                  ingredientId={ing.id}
                  ingredientName={ing.name}
                  currentStock={ing.currentStock}
                  unit={ing.unit}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
