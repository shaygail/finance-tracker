import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QrDisplay } from "@/components/inventory/qr-display";
import { StockCountForm } from "@/components/inventory/stock-count-form";
import { IngredientSectionSelect } from "@/components/inventory/ingredient-section-select";
import Link from "next/link";
import { AlertTriangle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  INGREDIENT_SECTIONS,
  INGREDIENT_SECTION_LABELS,
  type IngredientSection,
} from "@/lib/inventory/sections";

export default async function IngredientsPage() {
  const businessId = await getBusinessId();

  const ingredients = await db.ingredient.findMany({
    where: { businessId },
    orderBy: [{ section: "asc" }, { name: "asc" }],
  });

  const bySection = Object.fromEntries(
    INGREDIENT_SECTIONS.map((s) => [s, [] as typeof ingredients])
  ) as Record<IngredientSection, typeof ingredients>;

  for (const ing of ingredients) {
    const section = (
      INGREDIENT_SECTIONS.includes(ing.section as IngredientSection)
        ? ing.section
        : "drinks"
    ) as IngredientSection;
    bySection[section].push(ing);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ingredients</h1>
          <p className="text-slate-500">
            {ingredients.length} items · grouped by Drinks, Siomai, and R&amp;D
          </p>
        </div>
        <Link href="/inventory/ingredients/print" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full sm:w-auto">
            <Printer className="mr-2 h-4 w-4" />
            Print QR labels
          </Button>
        </Link>
      </div>

      {INGREDIENT_SECTIONS.map((section) => {
        const items = bySection[section];
        return (
          <section key={section} className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-2">
              <h2 className="text-lg font-semibold text-slate-900">
                {INGREDIENT_SECTION_LABELS[section]}
              </h2>
              <p className="text-sm text-slate-500">
                {items.length} item{items.length === 1 ? "" : "s"}
              </p>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-slate-400">
                No ingredients in this section yet — move an item here with the
                dropdown on a card.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((ing) => {
                  const lowStock = ing.currentStock <= ing.parLevel;
                  return (
                    <Card key={ing.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
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
                        <IngredientSectionSelect
                          ingredientId={ing.id}
                          section={ing.section}
                        />
                        <div className="flex justify-center">
                          <QrDisplay value={ing.qrCode} label={ing.qrCode} />
                        </div>
                        <div className="text-center text-sm text-slate-600">
                          <p>
                            Stock:{" "}
                            <span className="font-semibold text-slate-900">
                              {ing.currentStock}
                            </span>{" "}
                            {ing.unit}
                          </p>
                          <p className="text-slate-400">
                            Par level: {ing.parLevel} {ing.unit}
                          </p>
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
            )}
          </section>
        );
      })}
    </div>
  );
}
