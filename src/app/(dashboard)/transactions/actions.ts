"use server";

import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { calculateGstFromInc } from "@/lib/gst/nz";
import { suggestCategory } from "@/lib/categorisation";
import { syncGoalsFromSurplus } from "@/lib/surplus";
import { revalidatePath } from "next/cache";

function parseDateOnly(raw: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T12:00:00.000Z`);
  }
  return new Date(raw);
}

async function resolveCategoryId(
  businessId: string,
  vendor: string,
  categoryId: string | null
): Promise<string | null> {
  if (categoryId) {
    const exists = await db.category.findFirst({
      where: { id: categoryId, businessId },
      select: { id: true },
    });
    return exists?.id ?? null;
  }
  const suggestion = await suggestCategory(businessId, vendor);
  return suggestion?.categoryId ?? null;
}

function revalidateTransactionPaths() {
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/goals");
  revalidatePath("/reports/gst");
}

export async function createTransaction(
  formData: FormData
): Promise<{ error?: string; href?: string }> {
  const businessId = await getBusinessId();

  const date = formData.get("date") as string;
  const vendor = (formData.get("vendor") as string)?.trim();
  const unitAmount = parseFloat(formData.get("unitAmount") as string);
  const quantity = parseFloat(formData.get("quantity") as string) || 1;
  const paymentMode = formData.get("paymentMode") as string;
  const categoryId = (formData.get("categoryId") as string) || null;
  const notes = ((formData.get("notes") as string) || "").trim() || null;

  if (!date || !vendor || isNaN(unitAmount)) {
    return { error: "Missing required fields" };
  }

  const totalAmount = Math.round(unitAmount * quantity * 100) / 100;
  const gst = calculateGstFromInc(totalAmount);
  const resolvedCategoryId = await resolveCategoryId(businessId, vendor, categoryId);

  await db.transaction.create({
    data: {
      businessId,
      categoryId: resolvedCategoryId,
      date: parseDateOnly(date),
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
  revalidateTransactionPaths();

  return {
    href: resolvedCategoryId
      ? `/transactions?categoryId=${resolvedCategoryId}`
      : "/transactions",
  };
}

export async function updateTransaction(
  formData: FormData
): Promise<{ error?: string; href?: string }> {
  const businessId = await getBusinessId();
  const id = String(formData.get("id") ?? "");

  const existing = await db.transaction.findFirst({
    where: { id, businessId },
    select: { id: true },
  });
  if (!existing) return { error: "Transaction not found" };

  const date = formData.get("date") as string;
  const vendor = (formData.get("vendor") as string)?.trim();
  const unitAmount = parseFloat(formData.get("unitAmount") as string);
  const quantity = parseFloat(formData.get("quantity") as string) || 1;
  const paymentMode = formData.get("paymentMode") as string;
  const categoryRaw = formData.get("categoryId") as string;
  const categoryId = categoryRaw === "" ? null : categoryRaw || null;
  const notes = ((formData.get("notes") as string) || "").trim() || null;

  if (!date || !vendor || isNaN(unitAmount)) {
    return { error: "Missing required fields" };
  }

  const totalAmount = Math.round(unitAmount * quantity * 100) / 100;
  const gst = calculateGstFromInc(totalAmount);

  const resolvedCategoryId = categoryId
    ? await resolveCategoryId(businessId, vendor, categoryId)
    : null;

  await db.transaction.update({
    where: { id },
    data: {
      categoryId: resolvedCategoryId,
      date: parseDateOnly(date),
      vendor,
      unitAmount,
      quantity,
      totalAmount,
      paymentMode,
      amountExGst: gst.amountExGst,
      gstAmount: gst.gstAmount,
      amountIncGst: gst.amountIncGst,
      notes,
    },
  });

  await syncGoalsFromSurplus(businessId);
  revalidateTransactionPaths();
  revalidatePath(`/transactions/${id}/edit`);

  return {
    href: resolvedCategoryId
      ? `/transactions?categoryId=${resolvedCategoryId}`
      : "/transactions",
  };
}

export async function deleteTransaction(
  formData: FormData
): Promise<{ error?: string; href?: string }> {
  const businessId = await getBusinessId();
  const id = String(formData.get("id") ?? "");

  const result = await db.transaction.deleteMany({ where: { id, businessId } });
  if (result.count === 0) return { error: "Transaction not found" };

  await syncGoalsFromSurplus(businessId);
  revalidateTransactionPaths();
  return { href: "/transactions" };
}
