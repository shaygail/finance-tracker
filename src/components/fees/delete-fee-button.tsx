"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteRentalMarketFee } from "@/app/(dashboard)/fees/actions";

export function DeleteFeeButton({ transactionId }: { transactionId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remove this fee entry?")) return;
        startTransition(async () => {
          await deleteRentalMarketFee(transactionId);
        });
      }}
    >
      {pending ? "…" : "Remove"}
    </Button>
  );
}
