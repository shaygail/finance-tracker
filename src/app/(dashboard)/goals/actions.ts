"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getBusinessId, requireSession } from "@/lib/session";

function parseMoney(raw: FormDataEntryValue | null): number | null {
  if (raw == null) return null;
  const n = Number(String(raw).replace(/[$,\s]/g, ""));
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

export async function createSavingsGoal(formData: FormData) {
  await requireSession();
  const businessId = await getBusinessId();

  const name = String(formData.get("name") ?? "").trim();
  const targetAmount = parseMoney(formData.get("targetAmount"));
  const currentAmount = parseMoney(formData.get("currentAmount")) ?? 0;
  const deadlineRaw = String(formData.get("deadline") ?? "").trim();

  if (!name) return { error: "Enter a goal name" };
  if (targetAmount == null || targetAmount <= 0) {
    return { error: "Enter a valid target amount" };
  }

  let deadline: Date | null = null;
  if (deadlineRaw) {
    const d = new Date(deadlineRaw);
    if (Number.isNaN(d.getTime())) return { error: "Enter a valid deadline" };
    deadline = d;
  }

  await db.savingsGoal.create({
    data: {
      businessId,
      name,
      targetAmount,
      currentAmount: Math.min(currentAmount, targetAmount),
      deadline,
    },
  });

  revalidatePath("/goals");
  return { ok: true };
}

export async function updateSavingsGoal(formData: FormData) {
  await requireSession();
  const businessId = await getBusinessId();

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const targetAmount = parseMoney(formData.get("targetAmount"));
  const currentAmount = parseMoney(formData.get("currentAmount"));
  const deadlineRaw = String(formData.get("deadline") ?? "").trim();

  if (!id) return { error: "Missing goal" };
  if (!name) return { error: "Enter a goal name" };
  if (targetAmount == null || targetAmount <= 0) {
    return { error: "Enter a valid target amount" };
  }
  if (currentAmount == null) return { error: "Enter a valid saved amount" };

  let deadline: Date | null = null;
  if (deadlineRaw) {
    const d = new Date(deadlineRaw);
    if (Number.isNaN(d.getTime())) return { error: "Enter a valid deadline" };
    deadline = d;
  }

  const existing = await db.savingsGoal.findFirst({
    where: { id, businessId },
  });
  if (!existing) return { error: "Goal not found" };

  await db.savingsGoal.update({
    where: { id },
    data: {
      name,
      targetAmount,
      currentAmount: Math.min(currentAmount, targetAmount),
      deadline,
    },
  });

  revalidatePath("/goals");
  return { ok: true };
}

export async function deleteSavingsGoal(formData: FormData) {
  await requireSession();
  const businessId = await getBusinessId();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing goal" };

  await db.savingsGoal.deleteMany({ where: { id, businessId } });
  revalidatePath("/goals");
  return { ok: true };
}
