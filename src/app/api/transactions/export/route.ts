import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateUtc } from "@/lib/utils";

function csvEscape(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = session.user.businessId;
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId");

  const where =
    categoryId === "uncategorised"
      ? { businessId, categoryId: null }
      : categoryId
        ? { businessId, categoryId }
        : { businessId };

  const transactions = await db.transaction.findMany({
    where,
    include: { category: true },
    orderBy: { date: "desc" },
  });

  const header = [
    "Date",
    "Vendor",
    "Category",
    "Payment mode",
    "Quantity",
    "Unit amount (inc GST)",
    "Ex GST",
    "GST",
    "Total",
    "Type",
    "Source",
    "Notes",
  ];

  const lines = [
    header.join(","),
    ...transactions.map((t) =>
      [
        formatDateUtc(t.date),
        csvEscape(t.vendor),
        csvEscape(t.category?.name ?? ""),
        csvEscape(t.paymentMode),
        t.quantity,
        t.unitAmount.toFixed(2),
        t.amountExGst.toFixed(2),
        t.gstAmount.toFixed(2),
        t.totalAmount.toFixed(2),
        csvEscape(t.type),
        csvEscape(t.source),
        csvEscape(t.notes),
      ].join(",")
    ),
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  const suffix =
    categoryId === "uncategorised"
      ? "uncategorised"
      : categoryId
        ? "category"
        : "all";

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transactions-${suffix}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
