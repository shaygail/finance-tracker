"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle } from "lucide-react";
import { previewExcel, importTransactions } from "@/app/(dashboard)/import/actions";

interface PreviewRow {
  date: string;
  purchases: string;
  amount: number;
  quantity: number;
  totalAmount: number;
  paymentMode: string;
  category: string;
  type?: "expense" | "refund";
  warning?: string;
}

export function ExcelUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setError(null);
    setSuccess(null);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", selected);

    const result = await previewExcel(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      setPreview([]);
      setWarnings([]);
      return;
    }

    setPreview(result.rows as PreviewRow[]);
    setWarnings(result.warnings ?? []);
  }

  async function handleImport() {
    if (!file) return;

    setImporting(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", file);

    const result = await importTransactions(formData);
    setImporting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    const warningNote =
      result.warnings && result.warnings > 0
        ? ` (${result.warnings} warning${result.warnings === 1 ? "" : "s"})`
        : "";
    setSuccess(`Successfully imported ${result.imported} transactions${warningNote}`);
    setPreview([]);
    setWarnings([]);
    setFile(null);
  }

  const hasWarnings = warnings.length > 0 || preview.some((row) => row.warning);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-emerald-600" />
            Upload Costing Sheet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">
            Upload a costing sheet in <strong>costing(Purchase S).csv</strong> format
            (with Total Supplies / Total COS bucket columns) or a standard 7-column
            spreadsheet: Date, Purchases, Amount, Quantity, Total Amount, Mode of Payment,
            Category.
          </p>
          <div className="flex items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-6 py-8 transition-colors hover:border-emerald-400 hover:bg-emerald-50/50">
              <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
              <div>
                <p className="font-medium text-slate-900">
                  {file ? file.name : "Choose .csv, .xlsx, or .xls file"}
                </p>
                <p className="text-sm text-slate-500">Click to browse</p>
              </div>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>
          {loading && <p className="text-sm text-slate-500">Parsing spreadsheet...</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && (
            <p className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle className="h-4 w-4" />
              {success}
            </p>
          )}
        </CardContent>
      </Card>

      {preview.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Preview ({preview.length} rows)</CardTitle>
              {hasWarnings && (
                <Badge variant="muted" className="border-amber-200 bg-amber-50 text-amber-700">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {warnings.length || preview.filter((r) => r.warning).length} warnings
                </Badge>
              )}
            </div>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? "Importing..." : `Import ${preview.length} rows`}
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Purchases</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium text-right">Qty</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Warning</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 30).map((row, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="px-4 py-2 text-slate-600">{row.date}</td>
                    <td className="px-4 py-2 font-medium text-slate-900">{row.purchases}</td>
                    <td className="px-4 py-2 text-right text-slate-600">${row.amount.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{row.quantity}</td>
                    <td className="px-4 py-2 text-right font-medium text-slate-900">
                      ${row.totalAmount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{row.paymentMode}</td>
                    <td className="px-4 py-2">
                      <Badge variant="muted">{row.category || "—"}</Badge>
                    </td>
                    <td className="px-4 py-2">
                      {row.warning ? (
                        <Badge variant="muted" className="border-amber-200 bg-amber-50 text-amber-700">
                          {row.warning}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 30 && (
              <p className="px-4 py-3 text-sm text-slate-400">
                Showing first 30 of {preview.length} rows
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
