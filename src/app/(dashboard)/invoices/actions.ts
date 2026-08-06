"use server";

import { getBusinessId, requireSession } from "@/lib/session";
import { disconnectGmail, syncGmailInvoices } from "@/lib/gmail/sync";
import { revalidatePath } from "next/cache";

export async function syncGmailData() {
  const session = await requireSession();
  if (session.user.role !== "owner") {
    return {
      ok: false,
      error: "Only owners can sync Gmail",
      connections: 0,
      imported: 0,
      updated: 0,
    };
  }

  const businessId = await getBusinessId();
  const result = await syncGmailInvoices(businessId);

  if (result.ok) {
    revalidatePath("/invoices");
    revalidatePath("/settings");
  }

  return result;
}

export async function disconnectGmailAccount(connectionId: string) {
  const session = await requireSession();
  if (session.user.role !== "owner") {
    return { ok: false, error: "Only owners can disconnect Gmail" };
  }

  const businessId = await getBusinessId();
  const result = await disconnectGmail(businessId, connectionId);

  if (result.ok) {
    revalidatePath("/invoices");
    revalidatePath("/settings");
  }

  return result;
}
