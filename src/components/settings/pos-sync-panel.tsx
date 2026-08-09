"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  syncPosData,
  setPosSyncEnabled,
} from "@/app/(dashboard)/settings/pos-actions";
import {
  RefreshCw,
  Database,
  CheckCircle,
  AlertCircle,
  Power,
  PowerOff,
} from "lucide-react";

interface PosSyncPanelProps {
  configured: boolean;
  syncEnabled: boolean;
  lastSyncedAt: string | null;
  saleCount: number;
  lastLogStatus?: string | null;
  lastLogMessage?: string | null;
}

export function PosSyncPanel({
  configured,
  syncEnabled,
  lastSyncedAt,
  saleCount,
  lastLogStatus,
  lastLogMessage,
}: PosSyncPanelProps) {
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
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

  async function handleToggle() {
    setToggling(true);
    setError(null);
    const res = await setPosSyncEnabled(!syncEnabled);
    setToggling(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={configured ? "success" : "warning"}>
          {configured ? "POS connected" : "Not configured"}
        </Badge>
        <Badge variant={syncEnabled ? "success" : "warning"}>
          {syncEnabled ? "Sync enabled" : "Sync disabled"}
        </Badge>
        {lastSyncedAt && (
          <span className="text-sm text-slate-500">
            Last sync: {new Date(lastSyncedAt).toLocaleString("en-NZ")}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-sm text-slate-500">Sales in this app</p>
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
          For STLL Haus POS, add to <code className="text-xs">.env</code>:{" "}
          <code className="text-xs">POS_PRESET=stllhaus</code> and{" "}
          <code className="text-xs">POS_API_URL=https://stllhaus-pos-production.up.railway.app</code>.
          See <code className="text-xs">docs/POS-INTEGRATION.md</code>.
        </p>
      )}

      {lastLogMessage && lastLogStatus === "error" && (
        <p className="flex items-start gap-2 text-sm text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {lastLogMessage}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={syncEnabled ? "outline" : "default"}
          onClick={handleToggle}
          disabled={toggling || !configured}
        >
          {syncEnabled ? (
            <PowerOff className="mr-2 h-4 w-4" />
          ) : (
            <Power className="mr-2 h-4 w-4" />
          )}
          {toggling
            ? "Updating…"
            : syncEnabled
              ? "Disable POS sync"
              : "Enable POS sync"}
        </Button>

        <Button
          type="button"
          onClick={handleSync}
          disabled={loading || !configured || !syncEnabled}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Syncing..." : "Sync from POS now"}
        </Button>
      </div>

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
        Read-only — clearing or syncing here never deletes or changes your POS database
      </p>
    </div>
  );
}
