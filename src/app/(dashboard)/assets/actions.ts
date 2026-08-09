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

function dayBounds(d: Date): { start: Date } {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return { start };
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
      datePurchased: true,
      unitCost: true,
      quantity: true,
    },
  });

  const purchases = await db.transaction.findMany({
    where: { businessId, type: { in: ["expense", "refund"] } },
    select: {
      id: true,
      vendor: true,
      date: true,
      unitAmount: true,
      totalAmount: true,
      quantity: true,
    },
  });

  let imported = 0;
  let skipped = parsed.skipped;
  const warnings = [...parsed.errors];

  for (const row of parsed.rows) {
    const key = normalizeAssetKey(row.name);
    const { start } = dayBounds(row.datePurchased);

    const duplicateAsset = existingAssets.some(
      (a) =>
        normalizeAssetKey(a.name) === key &&
        sameCalendarDay(a.datePurchased, row.datePurchased) &&
        moneyClose(a.unitCost, row.unitCost) &&
        Math.abs(a.quantity - row.quantity) < 0.01
    );

    if (duplicateAsset) {
      skipped += 1;
      continue;
    }

    const matchingPurchase = purchases.find((t) => {
      if (!sameCalendarDay(t.date, row.datePurchased)) return false;
      const vendorKey = normalizeAssetKey(t.vendor);
      const nameMatch =
        vendorKey === key ||
        vendorKey.includes(key) ||
        key.includes(vendorKey);
      if (!nameMatch) return false;
      return (
        moneyClose(t.unitAmount, row.unitCost) ||
        moneyClose(t.totalAmount, row.totalCost) ||
        moneyClose(t.totalAmount, row.unitCost)
      );
    });

    // Same item already recorded as a purchase on that date — skip (no duplicate)
    if (matchingPurchase) {
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
        datePurchased: start,
        unitCost: row.unitCost,
        totalCost: row.totalCost,
        source: "csv",
      },
    });

    existingAssets.push({
      name: row.name,
      datePurchased: start,
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
