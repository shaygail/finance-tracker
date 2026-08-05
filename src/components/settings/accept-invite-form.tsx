"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { acceptInvite } from "@/app/(dashboard)/settings/actions";

export function AcceptInviteForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("token", token);

    const result = await acceptInvite(formData);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    const password = formData.get("password") as string;
    const signInResult = await signIn("credentials", {
      email: result.email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (signInResult?.error) {
      setError("Account created — please log in manually.");
      router.push("/login");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
        <Input value={email} disabled />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Your name</label>
        <Input name="name" required placeholder="Jane Accountant" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
        <Input name="password" type="password" required minLength={6} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating account..." : "Accept & join"}
      </Button>
    </form>
  );
}
