import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  classifyDrinkSize,
  expandCupLines,
  isCupSaleItem,
  siblingSizeFromSaleLines,
} from "@/lib/cups";
import { canonicalizeProductName } from "@/lib/pos/product-aliases";
import {
  extractDrinkAddOns,
  meaningfulSaleOptions,
} from "@/lib/sales/options";
import { SALE_CHANNEL_LABELS, type SaleChannel } from "@/lib/sales/channels";
import { formatDateUtc } from "@/lib/utils";

function csvEscape(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = session.user.businessId;

  const sales = await db.sale.findMany({
    where: { businessId },
    include: {
      lines: {
        orderBy: { id: "asc" },
        include: { product: { select: { sku: true } } },
      },
    },
    orderBy: { soldAt: "desc" },
  });

  const header = [
    "Sold at",
    "Customer",
    "Payment",
    "Channel",
    "POS sale ID",
    "Source",
    "Order total",
    "Order ex GST",
    "Order GST",
    "Order inc GST",
    "Line type",
    "Product (raw)",
    "Product",
    "SKU",
    "Quantity",
    "Unit price",
    "Line total",
    "Size",
    "Add-ons",
    "All options",
    "Notes (raw)",
  ];

  const rows: string[] = [header.join(",")];

  for (const sale of sales) {
    const siblingSize = siblingSizeFromSaleLines(sale.lines);

    if (sale.lines.length === 0) {
      rows.push(
        [
          formatDateUtc(sale.soldAt),
          csvEscape(sale.customerName ?? ""),
          csvEscape(sale.paymentMode),
          csvEscape(
            SALE_CHANNEL_LABELS[sale.channel as SaleChannel] ?? sale.channel
          ),
          csvEscape(sale.posSaleId),
          csvEscape(sale.source),
          sale.totalAmount.toFixed(2),
          sale.amountExGst.toFixed(2),
          sale.gstAmount.toFixed(2),
          sale.amountIncGst.toFixed(2),
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ].join(",")
      );
      continue;
    }

    for (const rawLine of sale.lines) {
      const base = {
        productName: rawLine.productName,
        quantity: rawLine.quantity,
        lineTotal: rawLine.lineTotal,
        unitPrice: rawLine.unitPrice,
        notes: rawLine.notes,
        sku: rawLine.product?.sku ?? null,
        siblingSize,
        soldAt: sale.soldAt,
      };

      const expanded = expandCupLines([base]);

      for (const line of expanded) {
        const isDrink = isCupSaleItem(line.productName, line.sku);
        const qty = Number(line.quantity) || 0;
        const lineTotal = Number(line.lineTotal) || 0;
        const unitPrice =
          line.unitPrice == null
            ? qty > 0
              ? lineTotal / qty
              : null
            : Number(line.unitPrice);

        let sizeLabel = "";
        if (isDrink) {
          sizeLabel = classifyDrinkSize(
            line.productName,
            line.notes,
            line.siblingSize,
            sale.soldAt,
            unitPrice != null && Number.isFinite(unitPrice) ? unitPrice : null
          ).label;
        }

        const addOns = extractDrinkAddOns(line.notes).join("; ");
        const allOptions = meaningfulSaleOptions(line.notes).join("; ");

        rows.push(
          [
            formatDateUtc(sale.soldAt),
            csvEscape(sale.customerName ?? ""),
            csvEscape(sale.paymentMode),
            csvEscape(
              SALE_CHANNEL_LABELS[sale.channel as SaleChannel] ?? sale.channel
            ),
            csvEscape(sale.posSaleId),
            csvEscape(sale.source),
            sale.totalAmount.toFixed(2),
            sale.amountExGst.toFixed(2),
            sale.gstAmount.toFixed(2),
            sale.amountIncGst.toFixed(2),
            isDrink ? "drink" : "other",
            csvEscape(line.productName),
            csvEscape(canonicalizeProductName(line.productName)),
            csvEscape(line.sku ?? ""),
            qty,
            unitPrice == null || Number.isNaN(unitPrice)
              ? ""
              : Number(unitPrice).toFixed(2),
            lineTotal.toFixed(2),
            csvEscape(sizeLabel),
            csvEscape(addOns),
            csvEscape(allOptions),
            csvEscape(line.notes ?? ""),
          ].join(",")
        );
      }
    }
  }

  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(rows.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sales-full-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
