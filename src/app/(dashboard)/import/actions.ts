"use server";

import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { parseSpreadsheetBuffer } from "@/lib/excel/parser";
import { calculateGstFromInc } from "@/lib/gst/nz";
import { suggestCategory } from "@/lib/categorisation";
import { revalidatePath } from "next/cache";

const CATEGORY_SLUG_MAP: Record<string, string> = {
  Supplies: "supplies",
  "Cost of Goods Sold": "cos",
  "Non Operating": "non-operating",
  "Equipment & Tools": "equipment-tools",
};

function resolveCategoryId(
  categoryName: string,
  categoryBySlug: Map<string, string>,
  categoryByName: Map<string, string>
): string | null {
  if (!categoryName || categoryName === "Uncategorised") {
    return null;
  }

  const slug = CATEGORY_SLUG_MAP[categoryName];
  if (slug && categoryBySlug.has(slug)) {
    return categoryBySlug.get(slug)!;
  }

  return categoryByName.get(categoryName.toLowerCase()) ?? null;
}

export async function importTransactions(formData: FormData) {
  const businessId = await getBusinessId();
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return { error: "No file uploaded", imported: 0, warnings: 0 };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { rows, errors, warnings } = parseSpreadsheetBuffer(buffer, file.name);

  if (errors.length > 0) {
    return { error: errors.join("; "), imported: 0, warnings: 0 };
  }

  if (rows.length === 0) {
    return { error: "No data rows found in spreadsheet", imported: 0, warnings: 0 };
  }

  const categories = await db.category.findMany({ where: { businessId } });
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]));
  const categoryByName = new Map(
    categories.map((c) => [c.name.toLowerCase(), c.id])
  );

  let imported = 0;

  for (const row of rows) {
    const totalAmount = row.totalAmount || row.amount * row.quantity;
    const gst = calculateGstFromInc(totalAmount);
    const transactionType = row.type === "refund" ? "refund" : "expense";

    let categoryId = resolveCategoryId(
      row.category,
      categoryBySlug,
      categoryByName
    );
    if (!categoryId) {
      const suggestion = await suggestCategory(businessId, row.purchases);
      if (suggestion) categoryId = suggestion.categoryId;
    }

    await db.transaction.create({
      data: {
        businessId,
        categoryId,
        date: new Date(row.date),
        vendor: row.purchases,
        unitAmount: row.amount,
        quantity: row.quantity,
        totalAmount,
        paymentMode: row.paymentMode,
        amountExGst: gst.amountExGst,
        gstAmount: gst.gstAmount,
        amountIncGst: gst.amountIncGst,
        gstType: "standard_15",
        type: transactionType,
        source: "import",
      },
    });
    imported++;
  }

  await db.importBatch.create({
    data: {
      businessId,
      filename: file.name,
      rowCount: imported,
    },
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/import");

  return {
    error: null,
    imported,
    warnings: warnings?.length ?? 0,
  };
}

export async function previewExcel(formData: FormData) {
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return {
      error: "No file uploaded",
      rows: [] as Array<Record<string, unknown>>,
      warnings: [] as string[],
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { rows, errors, warnings } = parseSpreadsheetBuffer(buffer, file.name);

  if (errors.length > 0) {
    return { error: errors.join("; "), rows: [], warnings: [] };
  }

  return { error: null, rows, warnings: warnings ?? [] };
}
