"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { calculateGstFromInc } from "@/lib/gst/nz";

function parseDateOnly(raw: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T12:00:00.000Z`);
  }
  return new Date(raw);
}

export async function addCashSale(
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const businessId = await getBusinessId();

  const dateRaw = String(formData.get("soldAt") ?? "").trim();
  const totalRaw = String(formData.get("totalAmount") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const totalAmount = Number(totalRaw.replace(/[$,\s]/g, ""));

  if (!dateRaw || Number.isNaN(totalAmount) || totalAmount <= 0) {
    return { error: "Enter a date and cash total greater than zero" };
  }

  const soldAt = parseDateOnly(dateRaw);
  const gst = calculateGstFromInc(totalAmount);
  const stamp = `${soldAt.toISOString().slice(0, 10)}-${Date.now()}`;

  await db.sale.create({
    data: {
      businessId,
      posSaleId: `cash-${stamp}`,
      soldAt,
      customerName: notes || "Cash sale",
      totalAmount: gst.amountIncGst,
      paymentMode: "Cash",
      amountExGst: gst.amountExGst,
      gstAmount: gst.gstAmount,
      amountIncGst: gst.amountIncGst,
      source: "cash",
      lines: {
        create: [
          {
            productName: notes || "Cash takings",
            quantity: 1,
            unitPrice: gst.amountIncGst,
            lineTotal: gst.amountIncGst,
            notes: notes || null,
          },
        ],
      },
    },
  });

  revalidatePath("/reports/gst");
  revalidatePath("/reports/sales");
  revalidatePath("/dashboard");
  revalidatePath("/goals");
  return { ok: true };
}

export async function deleteCashSale(
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const businessId = await getBusinessId();
  const id = String(formData.get("id") ?? "");

  const existing = await db.sale.findFirst({
    where: { id, businessId, source: "cash" },
    select: { id: true },
  });
  if (!existing) return { error: "Cash sale not found" };

  await db.sale.delete({ where: { id } });

  revalidatePath("/reports/gst");
  revalidatePath("/reports/sales");
  revalidatePath("/dashboard");
  revalidatePath("/goals");
  return { ok: true };
}
