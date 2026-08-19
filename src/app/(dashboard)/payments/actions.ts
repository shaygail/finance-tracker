"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { calculateGstFromInc } from "@/lib/gst/nz";
import { syncGoalsFromSurplus } from "@/lib/surplus";

function parseDateInput(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/** Manual cash only when it was never rung up in POS (do not use for POS cash). */
export async function addCashTaking(formData: FormData) {
  const businessId = await getBusinessId();
  const dateRaw = String(formData.get("date") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const customerName =
    String(formData.get("label") ?? "").trim() || "Cash taking";

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid cash amount greater than zero" };
  }
  const date = parseDateInput(dateRaw);
  if (!date) {
    return { error: "Choose a valid date" };
  }

  const gst = calculateGstFromInc(amount);
  const posSaleId = `cash-manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await db.sale.create({
    data: {
      businessId,
      posSaleId,
      soldAt: date,
      customerName,
      totalAmount: amount,
      paymentMode: "Cash",
      channel: "stall",
      amountExGst: gst.amountExGst,
      gstAmount: gst.gstAmount,
      amountIncGst: gst.amountIncGst,
      source: "cash_manual",
      lines: {
        create: {
          productName: notes ? `Cash taking — ${notes}` : "Cash taking",
          quantity: 1,
          unitPrice: amount,
          lineTotal: amount,
          notes: notes,
        },
      },
    },
  });

  await syncGoalsFromSurplus(businessId);
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/reports/sales");
  revalidatePath("/goals");

  return { error: null as string | null };
}

export async function deleteCashTaking(saleId: string) {
  const businessId = await getBusinessId();
  const sale = await db.sale.findFirst({
    where: { id: saleId, businessId, source: "cash_manual" },
  });
  if (!sale) return { error: "Cash entry not found" };

  await db.sale.delete({ where: { id: sale.id } });
  await syncGoalsFromSurplus(businessId);
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/reports/sales");
  revalidatePath("/goals");
  return { error: null as string | null };
}
