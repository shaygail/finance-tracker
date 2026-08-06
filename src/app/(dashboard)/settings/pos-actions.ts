"use server";

import { getBusinessId, requireSession } from "@/lib/session";
import { syncFromPos } from "@/lib/pos/sync";
import { revalidatePath } from "next/cache";

export async function syncPosData() {
  const session = await requireSession();
  if (session.user.role !== "owner") {
    return { error: "Only owners can sync POS data", productsSync: 0, salesSync: 0 };
  }

  const businessId = await getBusinessId();
  const result = await syncFromPos(businessId);

  if (result.ok) {
    revalidatePath("/dashboard");
    revalidatePath("/products");
    revalidatePath("/reports/sales");
    revalidatePath("/reports/gst");
    revalidatePath("/settings");
    revalidatePath("/goals");
  }

  return result;
}
