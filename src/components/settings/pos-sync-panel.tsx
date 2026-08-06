"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { syncPosData } from "@/app/(dashboard)/settings/pos-actions";
import { RefreshCw, Database, CheckCircle, AlertCircle } from "lucide-react";

interface PosSyncPanelProps {
  configured: boolean;
  lastSyncedAt: string | null;
  saleCount: number;
  lastLogStatus?: string | null;
  lastLogMessage?: string | null;
}

export function PosSyncPanel({
  configured,
  lastSyncedAt,
  saleCount,
  lastLogStatus,
  lastLogMessage,
}: PosSyncPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    setError(null);
    const res = await syncPosData();
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setResult(`Synced ${res.productsSync} products and ${res.salesSync} new sales`);
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={configured ? "success" : "warning"}>
          {configured ? "POS connected" : "Not configured"}
        </Badge>
        {lastSyncedAt && (
          <span className="text-sm text-slate-500">
            Last sync: {new Date(lastSyncedAt).toLocaleString("en-NZ")}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-sm text-slate-500">Sales in system</p>
          <p className="text-xl font-bold text-slate-900">{saleCount}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-sm text-slate-500">Last sync status</p>
          <p className="text-sm font-medium text-slate-900">
            {lastLogStatus ?? "Never synced"}
          </p>
        </div>
      </div>

      {!configured && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          For STLL Haus POS on Railway, add to <code className="text-xs">.env</code>:{" "}
          <code className="text-xs">POS_PRESET=stllhaus</code>,{" "}
          <code className="text-xs">POS_DATABASE_URL</code> (from Railway Postgres → Connect), and{" "}
          <code className="text-xs">POS_DATABASE_SSL=true</code>. See{" "}
          <code className="text-xs">docs/POS-INTEGRATION.md</code>.
        </p>
      )}

      {lastLogMessage && lastLogStatus === "error" && (
        <p className="flex items-start gap-2 text-sm text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {lastLogMessage}
        </p>
      )}

      <Button onClick={handleSync} disabled={loading || !configured}>
        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Syncing..." : "Sync from POS now"}
      </Button>

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

      <p className="flex items-center gap-2 text-xs text-slate-400">
        <Database className="h-3 w-3" />
        Read-only sync — your POS database is never modified
      </p>
    </div>
  );
}
