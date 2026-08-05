"use server";

import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
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
