"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getBusinessId, requireOwner } from "@/lib/session";

function parseDateTime(raw: FormDataEntryValue | null): Date | null {
  if (!raw) return null;
  const value = String(raw).trim();
  // Date-only inputs → noon UTC so NZ display stays on the chosen day
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T12:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseFloatValue(raw: FormDataEntryValue | null): number | null {
  if (raw == null || String(raw).trim() === "") return null;
  const n = Number(String(raw).replace(/[$,\s]/g, ""));
  return Number.isNaN(n) ? null : n;
}

function revalidateCompliance(path: string) {
  revalidatePath("/compliance");
  revalidatePath(path);
}

export async function addTempLog(formData: FormData) {
  await requireOwner();
  const businessId = await getBusinessId();
  const kind = String(formData.get("kind") ?? "");
  if (kind !== "milk_chiller" && kind !== "transport") {
    return { error: "Invalid log type" };
  }
  const loggedAt = parseDateTime(formData.get("loggedAt")) ?? new Date();
  const location = String(formData.get("location") ?? "").trim();
  const temperatureC = parseFloatValue(formData.get("temperatureC"));
  if (!location) return { error: "Enter a location" };
  if (temperatureC == null) return { error: "Enter a temperature" };

  await db.tempLog.create({
    data: {
      businessId,
      kind,
      loggedAt,
      location,
      temperatureC,
      notes: String(formData.get("notes") ?? "").trim() || null,
      recordedBy: String(formData.get("recordedBy") ?? "").trim() || null,
    },
  });

  const path =
    kind === "milk_chiller" ? "/compliance/milk-chiller" : "/compliance/transport";
  revalidateCompliance(path);
  return { ok: true };
}

export async function deleteTempLog(formData: FormData) {
  await requireOwner();
  const businessId = await getBusinessId();
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  await db.tempLog.deleteMany({ where: { id, businessId } });
  revalidateCompliance(
    kind === "transport" ? "/compliance/transport" : "/compliance/milk-chiller"
  );
  return { ok: true };
}

export async function addThermometerCalibration(formData: FormData) {
  await requireOwner();
  const businessId = await getBusinessId();
  const method = String(formData.get("method") ?? "");
  if (method !== "ice_slurry" && method !== "boiling_water") {
    return { error: "Choose ice slurry or boiling water" };
  }
  const calibratedAt = parseDateTime(formData.get("calibratedAt")) ?? new Date();
  const readingC = parseFloatValue(formData.get("readingC"));
  if (readingC == null) return { error: "Enter the thermometer reading" };
  const expected = method === "ice_slurry" ? 0 : 100;
  const passed =
    formData.get("passed") === "on" || formData.get("passed") === "true"
      ? true
      : Math.abs(readingC - expected) <= 1;

  await db.thermometerCalibration.create({
    data: {
      businessId,
      calibratedAt,
      method,
      readingC,
      passed,
      notes: String(formData.get("notes") ?? "").trim() || null,
      recordedBy: String(formData.get("recordedBy") ?? "").trim() || null,
    },
  });
  revalidateCompliance("/compliance/thermometer-calibration");
  return { ok: true };
}

export async function deleteThermometerCalibration(formData: FormData) {
  await requireOwner();
  const businessId = await getBusinessId();
  const id = String(formData.get("id") ?? "");
  await db.thermometerCalibration.deleteMany({ where: { id, businessId } });
  revalidateCompliance("/compliance/thermometer-calibration");
  return { ok: true };
}

export async function addCleaningChecklist(formData: FormData) {
  await requireOwner();
  const businessId = await getBusinessId();
  const cleanedAt = parseDateTime(formData.get("cleanedAt")) ?? new Date();

  await db.cleaningChecklist.create({
    data: {
      businessId,
      cleanedAt,
      benches: formData.get("benches") === "on",
      milkJugs: formData.get("milkJugs") === "on",
      steamWands: formData.get("steamWands") === "on",
      notes: String(formData.get("notes") ?? "").trim() || null,
      recordedBy: String(formData.get("recordedBy") ?? "").trim() || null,
    },
  });
  revalidateCompliance("/compliance/cleaning");
  return { ok: true };
}

export async function deleteCleaningChecklist(formData: FormData) {
  await requireOwner();
  const businessId = await getBusinessId();
  const id = String(formData.get("id") ?? "");
  await db.cleaningChecklist.deleteMany({ where: { id, businessId } });
  revalidateCompliance("/compliance/cleaning");
  return { ok: true };
}

export async function addSupplierReceipt(formData: FormData) {
  await requireOwner();
  const businessId = await getBusinessId();
  const purchasedAt = parseDateTime(formData.get("purchasedAt")) ?? new Date();
  const supplier = String(formData.get("supplier") ?? "").trim();
  const items = String(formData.get("items") ?? "").trim();
  if (!supplier) return { error: "Enter the supplier name" };
  if (!items) return { error: "Describe what was purchased" };

  const file = formData.get("file");
  let fileName: string | null = null;
  let fileMime: string | null = null;
  let fileData: Buffer | null = null;

  if (file instanceof File && file.size > 0) {
    if (file.size > 10 * 1024 * 1024) return { error: "File max 10 MB" };
    const mime = (file.type || "").toLowerCase();
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    const ok =
      mime === "application/pdf" ||
      mime === "image/jpeg" ||
      mime === "image/jpg" ||
      [".pdf", ".jpg", ".jpeg"].includes(ext);
    if (!ok) return { error: "Upload a JPEG or PDF receipt" };
    fileName = file.name;
    fileMime = mime === "image/jpg" ? "image/jpeg" : mime || (ext === ".pdf" ? "application/pdf" : "image/jpeg");
    fileData = Buffer.from(await file.arrayBuffer());
  }

  const receipt = await db.supplierReceipt.create({
    data: {
      businessId,
      purchasedAt,
      supplier,
      items,
      amount: parseFloatValue(formData.get("amount")),
      fileName,
      fileMime,
      fileData: fileData ?? undefined,
    },
  });

  revalidateCompliance("/compliance/supplier-receipts");
  return { ok: true, id: receipt.id };
}

export async function deleteSupplierReceipt(formData: FormData) {
  await requireOwner();
  const businessId = await getBusinessId();
  const id = String(formData.get("id") ?? "");
  await db.supplierReceipt.deleteMany({ where: { id, businessId } });
  revalidateCompliance("/compliance/supplier-receipts");
  return { ok: true };
}

export async function addTrainingSignOff(formData: FormData) {
  await requireOwner();
  const businessId = await getBusinessId();
  const personName = String(formData.get("personName") ?? "").trim();
  if (!personName) return { error: "Enter the person’s name" };
  const signedAt = parseDateTime(formData.get("signedAt")) ?? new Date();

  await db.trainingSignOff.create({
    data: {
      businessId,
      personName,
      personRole: String(formData.get("personRole") ?? "owner").trim() || "owner",
      signedAt,
      acknowledgedFcp: formData.get("acknowledgedFcp") === "on",
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });
  revalidateCompliance("/compliance/training");
  return { ok: true };
}

export async function deleteTrainingSignOff(formData: FormData) {
  await requireOwner();
  const businessId = await getBusinessId();
  const id = String(formData.get("id") ?? "");
  await db.trainingSignOff.deleteMany({ where: { id, businessId } });
  revalidateCompliance("/compliance/training");
  return { ok: true };
}

export async function addAllergenItem(formData: FormData) {
  await requireOwner();
  const businessId = await getBusinessId();
  const productName = String(formData.get("productName") ?? "").trim();
  if (!productName) return { error: "Enter a product or menu item name" };

  await db.allergenItem.create({
    data: {
      businessId,
      productName,
      containsGluten: formData.get("containsGluten") === "on",
      containsDairy: formData.get("containsDairy") === "on",
      containsSoy: formData.get("containsSoy") === "on",
      containsEgg: formData.get("containsEgg") === "on",
      containsPeanut: formData.get("containsPeanut") === "on",
      containsTreeNut: formData.get("containsTreeNut") === "on",
      containsFish: formData.get("containsFish") === "on",
      containsShellfish: formData.get("containsShellfish") === "on",
      containsSesame: formData.get("containsSesame") === "on",
      containsSulphites: formData.get("containsSulphites") === "on",
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });
  revalidateCompliance("/compliance/allergens");
  return { ok: true };
}

export async function deleteAllergenItem(formData: FormData) {
  await requireOwner();
  const businessId = await getBusinessId();
  const id = String(formData.get("id") ?? "");
  await db.allergenItem.deleteMany({ where: { id, businessId } });
  revalidateCompliance("/compliance/allergens");
  return { ok: true };
}
