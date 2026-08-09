"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { importAssetRegistry } from "@/app/(dashboard)/assets/actions";
import { Upload, FileUp, CheckCircle, AlertCircle } from "lucide-react";

export function AssetRegistryUploader() {
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const form = e.currentTarget;
    const result = await importAssetRegistry(new FormData(form));
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(
      result.message ??
        `Imported ${result.imported} assets, skipped ${result.skipped} duplicates/empty rows`
    );
    setFileName(null);
    form.reset();
    window.location.reload();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-emerald-600" />
          Upload asset registry CSV
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-slate-600">
            Expects columns: Name, Description, Location, Model, Brand, Quantity, Date of
            Purchase, Cost per Unit. Repeat purchases of the same item (different dates or
            models) are kept. Only exact duplicate lines are skipped on re-upload.
          </p>
          <label
            htmlFor="asset-file"
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center hover:border-emerald-400 hover:bg-emerald-50/40"
          >
            <FileUp className="mb-2 h-8 w-8 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">
              {fileName ?? "Choose Asset Registry CSV"}
            </span>
            <input
              id="asset-file"
              name="file"
              type="file"
              accept=".csv,.xlsx,.xls,text/csv"
              required
              className="sr-only"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </label>
          <Button type="submit" disabled={loading}>
            {loading ? "Importing…" : "Import assets"}
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
