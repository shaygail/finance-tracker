"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { calculateGstFromInc } from "@/lib/gst/nz";
import { syncGoalsFromSurplus } from "@/lib/surplus";
import { ensureSubscriptionsCategory } from "@/lib/fees/subscriptions";

function parseDateInput(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export async function addSubscription(formData: FormData) {
  const businessId = await getBusinessId();
  const dateRaw = String(formData.get("date") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const vendor = String(formData.get("vendor") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const gstFree = String(formData.get("gstFree") ?? "") === "on";

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid amount greater than zero" };
  }
  const date = parseDateInput(dateRaw);
  if (!date) return { error: "Choose a valid date" };
  if (!vendor) {
    return { error: "Enter what you pay for (e.g. Cursor, domain, Google Workspace)" };
  }

  const category = await ensureSubscriptionsCategory(businessId);
  const gst = gstFree
    ? { amountExGst: amount, gstAmount: 0, amountIncGst: amount }
    : calculateGstFromInc(amount);

  await db.transaction.create({
    data: {
      businessId,
      categoryId: category.id,
      date,
      vendor,
      unitAmount: amount,
      quantity: 1,
      totalAmount: amount,
      paymentMode: "Credit Card",
      amountExGst: gst.amountExGst,
      gstAmount: gst.gstAmount,
      amountIncGst: gst.amountIncGst,
      gstType: gstFree ? "zero" : "standard_15",
      type: "expense",
      source: "manual",
      notes,
    },
  });

  await syncGoalsFromSurplus(businessId);
  revalidatePath("/subscriptions");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/goals");

  return { error: null as string | null };
}

export async function deleteSubscription(transactionId: string) {
  const businessId = await getBusinessId();
  const category = await ensureSubscriptionsCategory(businessId);
  const tx = await db.transaction.findFirst({
    where: {
      id: transactionId,
      businessId,
      categoryId: category.id,
    },
  });
  if (!tx) return { error: "Subscription entry not found" };

  await db.transaction.delete({ where: { id: tx.id } });
  await syncGoalsFromSurplus(businessId);
  revalidatePath("/subscriptions");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/goals");
  return { error: null as string | null };
}
