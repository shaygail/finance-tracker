import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { formatCurrency, formatDateUtc } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComplianceForm, DeleteRecordButton } from "@/components/compliance/compliance-form";
import { ComplianceBackLink } from "@/components/compliance/back-link";
import {
  fieldClass,
  labelClass,
  toLocalDateValue,
} from "@/components/compliance/field-styles";
import { addSupplierReceipt, deleteSupplierReceipt } from "../actions";
import { Paperclip, Store } from "lucide-react";

export default async function SupplierReceiptsPage() {
  const businessId = await getBusinessId();
  const receipts = await db.supplierReceipt.findMany({
    where: { businessId },
    orderBy: { purchasedAt: "desc" },
    select: {
      id: true,
      purchasedAt: true,
      supplier: true,
      items: true,
      amount: true,
      fileName: true,
      fileMime: true,
    },
    take: 200,
  });

  const today = toLocalDateValue();

  return (
    <div className="space-y-6">
      <ComplianceBackLink />
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Supplier Receipts</h1>
        <p className="text-slate-500">
          Invoices or receipts proving milk, coffee beans, and food come from registered commercial
          suppliers.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add supplier receipt</CardTitle>
        </CardHeader>
        <CardContent>
          <ComplianceForm
            action={addSupplierReceipt}
            className="grid gap-4 sm:grid-cols-2"
            submitLabel="Save receipt"
          >
            <div>
              <label className={labelClass} htmlFor="purchasedAt">
                Purchase date
              </label>
              <input
                id="purchasedAt"
                name="purchasedAt"
                type="date"
                required
                defaultValue={today}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="supplier">
                Supplier
              </label>
              <input
                id="supplier"
                name="supplier"
                required
                placeholder="Registered supplier name"
                className={fieldClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="items">
                Items purchased
              </label>
              <input
                id="items"
                name="items"
                required
                placeholder="Milk, beans, muffins…"
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="amount">
                Amount (optional)
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="file">
                Receipt file (JPEG or PDF)
              </label>
              <input
                id="file"
                name="file"
                type="file"
                accept=".jpg,.jpeg,.pdf,image/jpeg,application/pdf"
                className={fieldClass}
              />
            </div>
          </ComplianceForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-emerald-600" />
            Receipts on file ({receipts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 p-0">
          {receipts.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-400">No supplier receipts yet</p>
          ) : (
            receipts.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-start justify-between gap-3 px-6 py-4"
              >
                <div>
                  <p className="font-medium text-slate-900">{r.supplier}</p>
                  <p className="text-sm text-slate-600">{r.items}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    <span>{formatDateUtc(r.purchasedAt)}</span>
                    {r.amount != null && (
                      <span className="font-medium text-slate-900">
                        {formatCurrency(r.amount)}
                      </span>
                    )}
                    {r.fileMime && (
                      <a
                        href={`/api/compliance/supplier-receipts/${r.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-600 hover:underline"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        {r.fileMime === "application/pdf" ? "View PDF" : "View image"}
                        {r.fileName ? ` (${r.fileName})` : ""}
                      </a>
                    )}
                  </div>
                </div>
                <DeleteRecordButton action={deleteSupplierReceipt} id={r.id} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
