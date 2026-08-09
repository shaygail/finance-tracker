"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getBusinessId, requireSession } from "@/lib/session";
import {
  moneyClose,
  normalizeAssetKey,
  parseAssetRegistryBuffer,
  sameCalendarDay,
} from "@/lib/excel/asset-registry-parser";

function dayStart(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0)
  );
}

function isSameAssetRow(
  existing: {
    name: string;
    model: string | null;
    datePurchased: Date;
    unitCost: number;
    quantity: number;
  },
  row: {
    name: string;
    model: string | null;
    datePurchased: Date;
    unitCost: number;
    quantity: number;
  }
): boolean {
  return (
    normalizeAssetKey(existing.name) === normalizeAssetKey(row.name) &&
    normalizeAssetKey(existing.model ?? "") === normalizeAssetKey(row.model ?? "") &&
    sameCalendarDay(existing.datePurchased, row.datePurchased) &&
    moneyClose(existing.unitCost, row.unitCost) &&
    Math.abs(existing.quantity - row.quantity) < 0.01
  );
}

export async function importAssetRegistry(formData: FormData) {
  await requireSession();
  const businessId = await getBusinessId();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an Asset Registry CSV to upload", imported: 0, skipped: 0 };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseAssetRegistryBuffer(buffer);

  if (parsed.errors.length > 0 && parsed.rows.length === 0) {
    return { error: parsed.errors.join("; "), imported: 0, skipped: parsed.skipped };
  }

  const existingAssets = await db.asset.findMany({
    where: { businessId },
    select: {
      name: true,
      model: true,
      datePurchased: true,
      unitCost: true,
      quantity: true,
    },
  });

  let imported = 0;
  let skipped = parsed.skipped;
  const warnings = [...parsed.errors];

  for (const row of parsed.rows) {
    const purchased = dayStart(row.datePurchased);

    // Skip only an exact same line (same name, model, purchase date, qty, cost).
    // Different purchase dates are always new assets (e.g. Squeeze Bottle on Feb / Mar / May).
    const duplicateAsset = existingAssets.some((a) =>
      isSameAssetRow(a, {
        name: row.name,
        model: row.model,
        datePurchased: purchased,
        unitCost: row.unitCost,
        quantity: row.quantity,
      })
    );

    if (duplicateAsset) {
      skipped += 1;
      continue;
    }

    await db.asset.create({
      data: {
        businessId,
        name: row.name,
        description: row.description,
        location: row.location,
        model: row.model,
        brand: row.brand,
        quantity: row.quantity,
        datePurchased: purchased,
        unitCost: row.unitCost,
        totalCost: row.totalCost,
        source: "csv",
      },
    });

    existingAssets.push({
      name: row.name,
      model: row.model,
      datePurchased: purchased,
      unitCost: row.unitCost,
      quantity: row.quantity,
    });

    imported += 1;
  }

  if (imported > 0) {
    await db.importBatch.create({
      data: {
        businessId,
        filename: file.name,
        rowCount: imported,
      },
    });
  }

  revalidatePath("/assets");
  revalidatePath("/import");

  return {
    ok: true,
    imported,
    skipped,
    warnings: warnings.length,
    message:
      warnings.length > 0
        ? `Imported ${imported}, skipped ${skipped}. ${warnings.length} row warning(s).`
        : undefined,
  };
}
