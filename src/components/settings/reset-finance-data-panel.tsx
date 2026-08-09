"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { resetFinanceData } from "@/app/(dashboard)/settings/pos-actions";
import { AlertTriangle, CheckCircle, AlertCircle, Trash2 } from "lucide-react";

export function ResetFinanceDataPanel() {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function handleReset() {
    setLoading(true);
    setError(null);
    setResult(null);
    const res = await resetFinanceData();
    setLoading(false);
    setConfirming(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    setResult(
      `Cleared ${res.salesDeleted ?? 0} sales, ${res.expensesDeleted ?? 0} expenses, ${res.importsDeleted ?? 0} imports. POS database unchanged.`
    );
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Wipe sales, expenses, invoices, and import history from this finance app so you can
        re-test CSV imports and POS sync. Your POS / Railway sales database is never modified.
      </p>

      {!confirming ? (
        <Button
          type="button"
          variant="destructive"
          onClick={() => {
            setConfirming(true);
            setError(null);
            setResult(null);
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Reset sales & expenses
        </Button>
      ) : (
        <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="flex items-start gap-2 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            This permanently deletes sales and expenses in the finance app only. Confirm to
            continue.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={handleReset}
              disabled={loading}
            >
              {loading ? "Resetting…" : "Yes, reset finance data"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirming(false)}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {result && (
        <p className="flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle className="h-4 w-4" />
          {result}
        </p>
      )}
      {error && (
        <p className="flex items-start gap-2 text-sm text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
