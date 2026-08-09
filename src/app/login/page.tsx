"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { DEMO_CREDENTIALS, BUSINESS } from "@/lib/constants";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loginWith(nextEmail: string, nextPassword: string) {
    setError("");
    setLoading(true);
    setEmail(nextEmail);
    setPassword(nextPassword);

    try {
      const result = await signIn("credentials", {
        email: nextEmail,
        password: nextPassword,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        return;
      }

      window.location.assign("/dashboard");
    } catch {
      setError("Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await loginWith(email.trim().toLowerCase(), password);
  }

  async function quickLogin(role: "owner" | "accountant") {
    const creds = DEMO_CREDENTIALS[role];
    await loginWith(creds.email, creds.password);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">{BUSINESS.name}</CardTitle>
          <p className="text-center text-sm text-slate-500">
            Sign in to manage finances & inventory
          </p>
        </CardHeader>
        <CardContent>
          <div className="mb-6 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Quick login
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                className="flex-1"
                disabled={loading}
                onClick={() => quickLogin("owner")}
              >
                {loading ? "Signing in..." : "Owner"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={loading}
                onClick={() => quickLogin("accountant")}
              >
                {loading ? "Signing in..." : "Accountant"}
              </Button>
            </div>
            <p className="text-xs text-slate-400">
              Same accounts on local + production · password{" "}
              <span className="font-mono">demo1234</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 border-t border-slate-100 pt-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.co.nz"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" variant="outline" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
