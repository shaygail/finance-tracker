"use client";

import { useTransition } from "react";
import { updateIngredientSection } from "@/app/(dashboard)/inventory/actions";
import {
  INGREDIENT_SECTIONS,
  INGREDIENT_SECTION_LABELS,
  type IngredientSection,
} from "@/lib/inventory/sections";

export function IngredientSectionSelect({
  ingredientId,
  section,
}: {
  ingredientId: string;
  section: string;
}) {
  const [pending, startTransition] = useTransition();
  const value = (INGREDIENT_SECTIONS as readonly string[]).includes(section)
    ? section
    : "drinks";

  return (
    <select
      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700"
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as IngredientSection;
        const formData = new FormData();
        formData.set("ingredientId", ingredientId);
        formData.set("section", next);
        startTransition(async () => {
          await updateIngredientSection(formData);
        });
      }}
    >
      {INGREDIENT_SECTIONS.map((s) => (
        <option key={s} value={s}>
          {INGREDIENT_SECTION_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
