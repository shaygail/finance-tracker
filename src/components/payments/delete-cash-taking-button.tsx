"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteCashTaking } from "@/app/(dashboard)/payments/actions";

export function DeleteCashTakingButton({ saleId }: { saleId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remove this cash entry?")) return;
        startTransition(async () => {
          await deleteCashTaking(saleId);
        });
      }}
    >
      {pending ? "…" : "Remove"}
    </Button>
  );
}
