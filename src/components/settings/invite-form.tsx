"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteAccountant } from "@/app/(dashboard)/settings/actions";

export function InviteAccountantForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setDevUrl(null);

    const formData = new FormData(e.currentTarget);
    const result = await inviteAccountant(formData);
    setLoading(false);

    if (result.error) {
      setMessage(result.error);
      return;
    }

    if (result.sent) {
      setMessage("Invitation email sent successfully.");
    } else if (result.devUrl) {
      setMessage("Resend not configured — use this invite link (dev mode):");
      setDevUrl(result.devUrl);
    } else {
      setMessage("Invitation created.");
    }

    (e.target as HTMLFormElement).reset();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Accountant email
        </label>
        <Input name="email" type="email" placeholder="accountant@example.co.nz" required />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Sending..." : "Send invite"}
      </Button>
      {message && <p className="text-sm text-slate-600">{message}</p>}
      {devUrl && (
        <p className="break-all rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{devUrl}</p>
      )}
    </form>
  );
}
