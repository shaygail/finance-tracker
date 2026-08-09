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

  const { id } = await context.params;
  const invoice = await db.invoice.findFirst({
    where: { id, businessId: session.user.businessId },
    select: {
      fileData: true,
      fileMime: true,
      fileName: true,
      subject: true,
    },
  });

  if (!invoice?.fileData) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const filename = invoice.fileName || `${invoice.subject || "invoice"}.bin`;
  const bytes = Buffer.from(invoice.fileData);

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": invoice.fileMime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
