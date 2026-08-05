"use server";

import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { calculateGstFromInc } from "@/lib/gst/nz";
import { suggestCategory } from "@/lib/categorisation";
import { syncGoalsFromSurplus } from "@/lib/surplus";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createTransaction(formData: FormData): Promise<void> {
  const businessId = await getBusinessId();

  const date = formData.get("date") as string;
  const vendor = formData.get("vendor") as string;
  const unitAmount = parseFloat(formData.get("unitAmount") as string);
  const quantity = parseFloat(formData.get("quantity") as string) || 1;
  const paymentMode = formData.get("paymentMode") as string;
  const categoryId = (formData.get("categoryId") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!date || !vendor || isNaN(unitAmount)) {
    throw new Error("Missing required fields");
  }

  const totalAmount = Math.round(unitAmount * quantity * 100) / 100;
  const gst = calculateGstFromInc(totalAmount);

  let resolvedCategoryId = categoryId;
  if (!resolvedCategoryId) {
    const suggestion = await suggestCategory(businessId, vendor);
    if (suggestion) {
      resolvedCategoryId = suggestion.categoryId;
    }
  }

  await db.transaction.create({
    data: {
      businessId,
      categoryId: resolvedCategoryId,
      date: new Date(date),
      vendor,
      unitAmount,
      quantity,
      totalAmount,
      paymentMode,
      amountExGst: gst.amountExGst,
      gstAmount: gst.gstAmount,
      amountIncGst: gst.amountIncGst,
      gstType: "standard_15",
      type: "expense",
      source: "manual",
      notes,
    },
  });

  await syncGoalsFromSurplus(businessId);

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/goals");
  redirect("/transactions");
}
