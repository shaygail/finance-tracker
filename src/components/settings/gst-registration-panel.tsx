"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setGstRegistered } from "@/app/(dashboard)/settings/actions";
import { Power, PowerOff } from "lucide-react";

export function GstRegistrationPanel({
  registered,
  gstNumber,
  canEdit,
}: {
  registered: boolean;
  gstNumber: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setGstRegistered(!registered);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={registered ? "success" : "muted"}>
          {registered ? "GST registered" : "Not GST registered"}
        </Badge>
        {gstNumber && (
          <span className="text-sm text-slate-500">GST# {gstNumber}</span>
        )}
      </div>

      <p className="text-sm text-slate-600">
        {registered
          ? "GST tax-to-pay and filing periods are shown on the dashboard and GST report. Turn this off if you are no longer registered."
          : "You’re not treated as GST-registered. Tax-to-pay and the GST report stay hidden. Amounts are still tracked as totals so you’re ready when you register."}
      </p>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {canEdit ? (
        <Button
          type="button"
          variant={registered ? "outline" : "default"}
          disabled={pending}
          onClick={toggle}
        >
          {registered ? (
            <>
              <PowerOff className="mr-2 h-4 w-4" />
              {pending ? "Updating…" : "Disable GST registered"}
            </>
          ) : (
            <>
              <Power className="mr-2 h-4 w-4" />
              {pending ? "Updating…" : "Enable — we are GST registered"}
            </>
          )}
        </Button>
      ) : (
        <p className="text-xs text-slate-400">Only the owner can change this setting.</p>
      )}
    </div>
  );
}
