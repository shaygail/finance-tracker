"use server";

import { getBusinessId, requireSession } from "@/lib/session";
import { syncFromPos } from "@/lib/pos/sync";
import { db } from "@/lib/db";
import { syncGoalsFromSurplus } from "@/lib/surplus";
import { revalidatePath } from "next/cache";

function revalidateFinancePaths() {
  revalidatePath("/dashboard");
  revalidatePath("/products");
  revalidatePath("/transactions");
  revalidatePath("/reports/sales");
  revalidatePath("/reports/gst");
  revalidatePath("/import");
  revalidatePath("/invoices");
  revalidatePath("/settings");
  revalidatePath("/goals");
}

export async function syncPosData() {
  const session = await requireSession();
  if (session.user.role !== "owner") {
    return { error: "Only owners can sync POS data", productsSync: 0, salesSync: 0 };
  }

  const businessId = await getBusinessId();
  const result = await syncFromPos(businessId);

  if (result.ok) {
    revalidateFinancePaths();
  }

  return result;
}

export async function setPosSyncEnabled(enabled: boolean) {
  const session = await requireSession();
  if (session.user.role !== "owner") {
    return { error: "Only owners can change POS sync settings" };
  }

  const businessId = await getBusinessId();
  await db.business.update({
    where: { id: businessId },
    data: { posSyncEnabled: enabled },
  });

  revalidatePath("/settings");
  return { ok: true, enabled };
}

/**
 * Clears sales, expenses, imports, and POS sync state in THIS app only.
 * Never connects to or writes the POS database.
 */
export async function resetFinanceData() {
  const session = await requireSession();
  if (session.user.role !== "owner") {
    return { error: "Only owners can reset finance data" };
  }

  const businessId = await getBusinessId();

  const [salesDeleted, expensesDeleted, importsDeleted] = await db.$transaction([
    db.sale.deleteMany({ where: { businessId } }),
    db.transaction.deleteMany({ where: { businessId } }),
    db.importBatch.deleteMany({ where: { businessId } }),
    db.posSyncLog.deleteMany({ where: { businessId } }),
    db.invoice.deleteMany({ where: { businessId } }),
    db.product.updateMany({
      where: { businessId },
      data: { unitsSold: 0, revenue: 0, lastSyncedAt: null },
    }),
    db.savingsGoal.updateMany({
      where: { businessId },
      data: { currentAmount: 0 },
    }),
    db.business.update({
      where: { id: businessId },
      data: { posLastSyncedAt: null },
    }),
  ]);

  await syncGoalsFromSurplus(businessId);
  revalidateFinancePaths();

  return {
    ok: true,
    salesDeleted: salesDeleted.count,
    expensesDeleted: expensesDeleted.count,
    importsDeleted: importsDeleted.count,
    message:
      "Finance app data cleared. Your POS database was not touched — re-enable sync and sync again to pull sales back.",
  };
}
