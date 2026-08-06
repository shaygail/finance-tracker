"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  syncGmailData,
  disconnectGmailAccount,
} from "@/app/(dashboard)/invoices/actions";
import {
  Mail,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Link2,
  Unlink,
} from "lucide-react";

type Connection = {
  id: string;
  email: string;
  lastSyncedAt: string | null;
};

interface GmailPanelProps {
  oauthConfigured: boolean;
  isOwner: boolean;
  connections: Connection[];
}

function statusMessage(gmail: string | null): { type: "ok" | "err"; text: string } | null {
  if (!gmail) return null;
  switch (gmail) {
    case "connected":
      return { type: "ok", text: "Gmail connected successfully. Click Sync to pull invoices." };
    case "denied":
      return { type: "err", text: "Google access was denied." };
    case "not_configured":
      return {
        type: "err",
        text: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env (see docs/GMAIL-INTEGRATION.md).",
      };
    case "forbidden":
      return { type: "err", text: "Only the business owner can connect Gmail." };
    case "no_refresh":
      return {
        type: "err",
        text: "Google did not return a refresh token. Disconnect the app in Google Account → revoke access, then try again.",
      };
    case "invalid":
    case "invalid_state":
    case "error":
      return { type: "err", text: "Gmail connection failed. Please try again." };
    default:
      return null;
  }
}

export function GmailPanel({
  oauthConfigured,
  isOwner,
  connections,
}: GmailPanelProps) {
  const searchParams = useSearchParams();
  const flash = statusMessage(searchParams.get("gmail"));
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(flash?.type === "err" ? flash.text : null);
  const [okFlash, setOkFlash] = useState<string | null>(
    flash?.type === "ok" ? flash.text : null
  );

  async function handleSync() {
    setLoading(true);
    setResult(null);
    setError(null);
    setOkFlash(null);
    const res = await syncGmailData();
    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? "Sync failed");
      return;
    }
    setResult(
      `Synced ${res.connections} inbox${res.connections === 1 ? "" : "es"} — ${res.imported} new, ${res.updated} updated`
    );
    window.location.href = "/invoices";
  }

  async function handleDisconnect(id: string) {
    setDisconnecting(id);
    setError(null);
    const res = await disconnectGmailAccount(id);
    setDisconnecting(null);
    if (!res.ok) {
      setError(res.error ?? "Disconnect failed");
      return;
    }
    window.location.href = "/invoices";
  }

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-emerald-600" />
          <p className="font-medium text-slate-900">Gmail inboxes</p>
          <Badge variant={connections.length > 0 ? "success" : "warning"}>
            {connections.length > 0
              ? `${connections.length} connected`
              : "Not connected"}
          </Badge>
        </div>
        {isOwner && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!oauthConfigured}
              onClick={() => {
                window.location.href = "/api/gmail/connect";
              }}
            >
              <Link2 className="mr-1.5 h-3.5 w-3.5" />
              Connect Gmail
            </Button>
            <Button
              size="sm"
              disabled={loading || connections.length === 0}
              onClick={handleSync}
            >
              <RefreshCw
                className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
              {loading ? "Syncing..." : "Sync invoices"}
            </Button>
          </div>
        )}
      </div>

      {!oauthConfigured && (
        <p className="text-sm text-amber-900">
          Google OAuth is not configured yet. Add{" "}
          <code className="text-xs">GOOGLE_CLIENT_ID</code> and{" "}
          <code className="text-xs">GOOGLE_CLIENT_SECRET</code> — see{" "}
          <code className="text-xs">docs/GMAIL-INTEGRATION.md</code>. You can
          connect up to all 3 of your Gmail accounts (Workspace + personal).
        </p>
      )}

      {connections.length > 0 ? (
        <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
          {connections.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">{c.email}</p>
                <p className="text-xs text-slate-500">
                  {c.lastSyncedAt
                    ? `Last sync: ${new Date(c.lastSyncedAt).toLocaleString("en-NZ")}`
                    : "Never synced"}
                </p>
              </div>
              {isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={disconnecting === c.id}
                  onClick={() => handleDisconnect(c.id)}
                >
                  <Unlink className="mr-1.5 h-3.5 w-3.5" />
                  {disconnecting === c.id ? "Removing..." : "Disconnect"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">
          Connect each inbox that receives supplier invoices. Mock demo invoices
          stay until you sync real mail.
        </p>
      )}

      {okFlash && (
        <p className="flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle className="h-4 w-4" />
          {okFlash}
        </p>
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
