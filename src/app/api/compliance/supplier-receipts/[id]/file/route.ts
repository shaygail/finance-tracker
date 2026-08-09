import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.userId || !session.user.businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const receipt = await db.supplierReceipt.findFirst({
    where: { id, businessId: session.user.businessId },
    select: { fileData: true, fileMime: true, fileName: true, supplier: true },
  });

  if (!receipt?.fileData) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const bytes = Buffer.from(receipt.fileData);
  const filename = receipt.fileName || `${receipt.supplier}-receipt.bin`;

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": receipt.fileMime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
