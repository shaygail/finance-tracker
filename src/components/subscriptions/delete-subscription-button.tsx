"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteSubscription } from "@/app/(dashboard)/subscriptions/actions";

export function DeleteSubscriptionButton({
  transactionId,
}: {
  transactionId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remove this subscription entry?")) return;
        startTransition(async () => {
          await deleteSubscription(transactionId);
        });
      }}
    >
      {pending ? "…" : "Remove"}
    </Button>
  );
}
