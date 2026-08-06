import { Suspense } from "react";
import { db } from "@/lib/db";
import { getBusinessId, requireSession } from "@/lib/session";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Paperclip } from "lucide-react";
import { getGmailStatus } from "@/lib/gmail/sync";
import { GmailPanel } from "@/components/invoices/gmail-panel";

export default async function InvoicesPage() {
  const session = await requireSession();
  const businessId = await getBusinessId();

  const [invoices, gmailStatus] = await Promise.all([
    db.invoice.findMany({
      where: { businessId },
      orderBy: { receivedAt: "desc" },
    }),
    getGmailStatus(businessId),
  ]);

  const connected = gmailStatus.connections.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
        <p className="text-slate-500">
          {connected
            ? `Gmail inbox — ${invoices.length} invoice${invoices.length !== 1 ? "s" : ""}`
            : `Inbox — ${invoices.length} invoice${invoices.length !== 1 ? "s" : ""} (connect Gmail to sync real mail)`}
        </p>
      </div>

      <Suspense fallback={<div className="h-24 animate-pulse rounded-lg bg-slate-100" />}>
        <GmailPanel
          oauthConfigured={gmailStatus.oauthConfigured}
          isOwner={session.user.role === "owner"}
          connections={gmailStatus.connections.map((c) => ({
            id: c.id,
            email: c.email,
            lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
          }))}
        />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-emerald-600" />
            Inbox
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 p-0">
          {invoices.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-400">
              No invoices found
            </p>
          ) : (
            invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-start gap-4 px-6 py-4 transition-colors hover:bg-slate-50"
              >
                <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <Mail className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{inv.subject}</p>
                    <Badge variant={inv.status === "matched" ? "success" : "warning"}>
                      {inv.status}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">{inv.fromEmail}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                    <span>{formatDate(inv.receivedAt)}</span>
                    {inv.vendor && <span>Vendor: {inv.vendor}</span>}
                    {inv.gmailEmail && (
                      <span className="text-slate-400">via {inv.gmailEmail}</span>
                    )}
                    {inv.amount != null && (
                      <span className="font-medium text-slate-900">
                        {formatCurrency(inv.amount)}
                      </span>
                    )}
                    {inv.attachmentUrl && (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <Paperclip className="h-3.5 w-3.5" />
                        Attachment
                      </span>
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
