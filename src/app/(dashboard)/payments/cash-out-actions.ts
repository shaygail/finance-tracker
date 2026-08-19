"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";

function parseDateInput(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/** Accountant memo only — never affects sales revenue or expenses. */
export async function addCashOutNote(formData: FormData) {
  const businessId = await getBusinessId();
  const dateRaw = String(formData.get("date") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid cash-out amount greater than zero" };
  }
  const date = parseDateInput(dateRaw);
  if (!date) {
    return { error: "Choose a valid date" };
  }

  await db.cashOutNote.create({
    data: {
      businessId,
      date,
      amount,
      label,
      notes,
    },
  });

  revalidatePath("/payments");
  return { error: null as string | null };
}

export async function deleteCashOutNote(id: string) {
  const businessId = await getBusinessId();
  const row = await db.cashOutNote.findFirst({
    where: { id, businessId },
  });
  if (!row) return { error: "Cash-out note not found" };

  await db.cashOutNote.delete({ where: { id: row.id } });
  revalidatePath("/payments");
  return { error: null as string | null };
}
