"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, CheckCircle, AlertCircle, FileUp } from "lucide-react";
import { uploadInvoice } from "@/app/(dashboard)/invoices/actions";

export function InvoiceUploader() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await uploadInvoice(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess("Invoice uploaded");
    setFileName(null);
    form.reset();
    window.location.reload();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-emerald-600" />
          Upload invoice
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="invoice-file">File (JPEG or PDF)</Label>
            <label
              htmlFor="invoice-file"
              className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center hover:border-emerald-400 hover:bg-emerald-50/40"
            >
              <FileUp className="mb-2 h-8 w-8 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">
                {fileName ?? "Choose a .jpg, .jpeg, or .pdf file"}
              </span>
              <span className="mt-1 text-xs text-slate-500">Max 10 MB</span>
              <input
                id="invoice-file"
                name="file"
                type="file"
                accept=".jpg,.jpeg,.pdf,image/jpeg,application/pdf"
                required
                className="sr-only"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="subject">Title (optional)</Label>
              <Input id="subject" name="subject" placeholder="e.g. Fonterra invoice" />
            </div>
            <div>
              <Label htmlFor="vendor">Vendor (optional)</Label>
              <Input id="vendor" name="vendor" placeholder="Supplier name" />
            </div>
            <div>
              <Label htmlFor="amount">Amount (optional)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="receivedAt">Date (optional)</Label>
              <Input id="receivedAt" name="receivedAt" type="date" />
            </div>
          </div>

          <Button type="submit" disabled={loading}>
            <Upload className="mr-2 h-4 w-4" />
            {loading ? "Uploading…" : "Upload invoice"}
          </Button>

          {error && (
            <p className="flex items-start gap-2 text-sm text-red-600">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
          {success && (
            <p className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle className="h-4 w-4" />
              {success}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
