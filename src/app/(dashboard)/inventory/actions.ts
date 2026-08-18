"use server";

import { db } from "@/lib/db";
import { requireSession, getBusinessId } from "@/lib/session";
import { isIngredientSection } from "@/lib/inventory/sections";
import { revalidatePath } from "next/cache";

export async function updateStockCount(formData: FormData) {
  const session = await requireSession();
  const ingredientId = formData.get("ingredientId") as string;
  const quantity = parseFloat(formData.get("quantity") as string);

  if (!ingredientId || isNaN(quantity) || quantity < 0) {
    return { error: "Invalid input" };
  }

  const ingredient = await db.ingredient.findUnique({
    where: { id: ingredientId },
  });

  if (!ingredient) {
    return { error: "Ingredient not found" };
  }

  await db.$transaction([
    db.stockCount.create({
      data: {
        ingredientId,
        quantity,
        countedById: session.user.userId,
      },
    }),
    db.ingredient.update({
      where: { id: ingredientId },
      data: { currentStock: quantity },
    }),
  ]);

  revalidatePath("/inventory/ingredients");
  revalidatePath("/inventory/scan");
  revalidatePath("/dashboard");

  return { error: null, ingredientName: ingredient.name, quantity };
}

export async function updateIngredientSection(formData: FormData) {
  const businessId = await getBusinessId();
  const ingredientId = String(formData.get("ingredientId") ?? "");
  const section = String(formData.get("section") ?? "");

  if (!ingredientId || !isIngredientSection(section)) {
    return { error: "Invalid section" };
  }

  const ingredient = await db.ingredient.findFirst({
    where: { id: ingredientId, businessId },
  });
  if (!ingredient) return { error: "Ingredient not found" };

  await db.ingredient.update({
    where: { id: ingredientId },
    data: { section },
  });

  revalidatePath("/inventory/ingredients");
  revalidatePath("/inventory/ingredients/print");
  revalidatePath("/inventory/scan");
  revalidatePath("/dashboard");

  return { error: null as string | null };
}
