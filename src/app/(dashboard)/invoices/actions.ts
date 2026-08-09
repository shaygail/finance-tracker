"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getBusinessId, requireSession } from "@/lib/session";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
]);

const ALLOWED_EXT = new Set([".pdf", ".jpg", ".jpeg"]);

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function normalizeMime(file: File): string | null {
  const mime = (file.type || "").toLowerCase();
  if (ALLOWED_MIME.has(mime)) {
    return mime === "image/jpg" ? "image/jpeg" : mime;
  }
  const ext = extensionOf(file.name);
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return null;
}

export async function uploadInvoice(formData: FormData) {
  const session = await requireSession();
  const businessId = await getBusinessId();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a JPEG or PDF file to upload" };
  }

  if (file.size > MAX_BYTES) {
    return { error: "File is too large (max 10 MB)" };
  }

  const mime = normalizeMime(file);
  const ext = extensionOf(file.name);
  if (!mime || !ALLOWED_EXT.has(ext)) {
    return { error: "Only JPEG (.jpg/.jpeg) and PDF (.pdf) files are allowed" };
  }

  const vendor = String(formData.get("vendor") ?? "").trim() || null;
  const subjectRaw = String(formData.get("subject") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const dateRaw = String(formData.get("receivedAt") ?? "").trim();

  let amount: number | null = null;
  if (amountRaw) {
    const n = Number(amountRaw.replace(/[$,\s]/g, ""));
    if (Number.isNaN(n) || n < 0) {
      return { error: "Enter a valid amount" };
    }
    amount = n;
  }

  let receivedAt = new Date();
  if (dateRaw) {
    const d = new Date(dateRaw);
    if (Number.isNaN(d.getTime())) {
      return { error: "Enter a valid date" };
    }
    receivedAt = d;
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const externalId = `upload:${crypto.randomUUID()}`;
  const subject = subjectRaw || file.name || "Uploaded invoice";

  const invoice = await db.invoice.create({
    data: {
      businessId,
      externalId,
      subject,
      fromEmail: session.user.email ?? "manual-upload",
      receivedAt,
      amount,
      vendor,
      status: "unmatched",
      fileName: file.name,
      fileMime: mime,
      fileData: bytes,
      attachmentUrl: null, // set after create with stable id
    },
  });

  await db.invoice.update({
    where: { id: invoice.id },
    data: { attachmentUrl: `/api/invoices/${invoice.id}/file` },
  });

  revalidatePath("/invoices");
  return { ok: true, id: invoice.id };
}
