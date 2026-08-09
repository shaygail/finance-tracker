import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComplianceForm, DeleteRecordButton } from "@/components/compliance/compliance-form";
import { ComplianceBackLink } from "@/components/compliance/back-link";
import {
  checkLabelClass,
  fieldClass,
  labelClass,
} from "@/components/compliance/field-styles";
import { addAllergenItem, deleteAllergenItem } from "../actions";
import { AlertTriangle } from "lucide-react";

const ALLERGEN_FLAGS = [
  { key: "containsGluten", label: "Gluten" },
  { key: "containsDairy", label: "Dairy" },
  { key: "containsSoy", label: "Soy" },
  { key: "containsEgg", label: "Egg" },
  { key: "containsPeanut", label: "Peanut" },
  { key: "containsTreeNut", label: "Tree nut" },
  { key: "containsFish", label: "Fish" },
  { key: "containsShellfish", label: "Shellfish" },
  { key: "containsSesame", label: "Sesame" },
  { key: "containsSulphites", label: "Sulphites" },
] as const;

export default async function AllergensPage() {
  const businessId = await getBusinessId();
  const items = await db.allergenItem.findMany({
    where: { businessId },
    orderBy: { productName: "asc" },
  });

  return (
    <div className="space-y-6">
      <ComplianceBackLink />
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Allergen Information</h1>
        <p className="text-slate-500">
          Clear list of which allergens are in food you sell (e.g. gluten in muffins, soy / almond /
          dairy milk options).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add menu item</CardTitle>
        </CardHeader>
        <CardContent>
          <ComplianceForm action={addAllergenItem} className="space-y-4">
            <div>
              <label className={labelClass} htmlFor="productName">
                Product / menu item
              </label>
              <input
                id="productName"
                name="productName"
                required
                placeholder="Flat white, blueberry muffin…"
                className={fieldClass}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Contains</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ALLERGEN_FLAGS.map((f) => (
                  <label key={f.key} className={checkLabelClass}>
                    <input type="checkbox" name={f.key} className="rounded border-slate-300" />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="notes">
                Notes (optional milk alternatives, “may contain”, etc.)
              </label>
              <input id="notes" name="notes" className={fieldClass} />
            </div>
          </ComplianceForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-emerald-600" />
            Allergen matrix ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {items.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-400">No allergen entries yet</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  {ALLERGEN_FLAGS.map((f) => (
                    <th key={f.key} className="px-2 py-3 font-medium">
                      {f.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-medium">Notes</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const hasAny = ALLERGEN_FLAGS.some((f) => item[f.key]);
                  return (
                    <tr key={item.id} className="align-top">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {item.productName}
                        {!hasAny && (
                          <span className="mt-0.5 block text-xs font-normal text-slate-400">
                            No listed allergens
                          </span>
                        )}
                      </td>
                      {ALLERGEN_FLAGS.map((f) => (
                        <td key={f.key} className="px-2 py-3 text-center">
                          {item[f.key] ? (
                            <span className="font-semibold text-amber-700">Y</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      ))}
                      <td className="max-w-[12rem] px-4 py-3 text-slate-500">{item.notes}</td>
                      <td className="px-4 py-3">
                        <DeleteRecordButton action={deleteAllergenItem} id={item.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
