"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type ActionResult = { error?: string; ok?: boolean; id?: string };

export function ComplianceForm({
  action,
  children,
  submitLabel = "Save record",
  className,
  resetOnSuccess = true,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      className={className}
      action={(formData) => {
        startTransition(async () => {
          const result = await action(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          setError(null);
          if (resetOnSuccess) formRef.current?.reset();
        });
      }}
    >
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {children}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

export function DeleteRecordButton({
  action,
  id,
  extraFields,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  id: string;
  extraFields?: Record<string, string>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          await action(formData);
        });
      }}
    >
      <input type="hidden" name="id" value={id} />
      {extraFields &&
        Object.entries(extraFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "…" : "Delete"}
      </Button>
    </form>
  );
}
