import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InvoiceUploader } from "@/components/invoices/invoice-uploader";
import { FileText, Paperclip } from "lucide-react";

export default async function InvoicesPage() {
  const businessId = await getBusinessId();

  const invoices = await db.invoice.findMany({
    where: { businessId },
    orderBy: { receivedAt: "desc" },
    select: {
      id: true,
      subject: true,
      fromEmail: true,
      receivedAt: true,
      amount: true,
      vendor: true,
      status: true,
      attachmentUrl: true,
      fileName: true,
      fileMime: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
        <p className="text-slate-500">
          Upload JPEG or PDF invoices · {invoices.length} on file
        </p>
      </div>

      <InvoiceUploader />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            Inbox
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 p-0">
          {invoices.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-400">
              No invoices yet — upload a JPEG or PDF above
            </p>
          ) : (
            invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-start gap-4 px-6 py-4 transition-colors hover:bg-slate-50"
              >
                <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <FileText className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{inv.subject}</p>
                    <Badge variant={inv.status === "matched" ? "success" : "warning"}>
                      {inv.status}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {inv.fromEmail}
                    {inv.fileName ? ` · ${inv.fileName}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                    <span>{formatDate(inv.receivedAt)}</span>
                    {inv.vendor && <span>Vendor: {inv.vendor}</span>}
                    {inv.amount != null && (
                      <span className="font-medium text-slate-900">
                        {formatCurrency(inv.amount)}
                      </span>
                    )}
                    {(inv.attachmentUrl || inv.fileMime) && (
                      <a
                        href={`/api/invoices/${inv.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-emerald-600 hover:underline"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {inv.fileMime === "application/pdf" ? "View PDF" : "View image"}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
