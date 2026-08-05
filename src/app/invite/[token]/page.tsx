import Link from "next/link";
import { db } from "@/lib/db";
import { AcceptInviteForm } from "@/components/settings/accept-invite-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await db.businessInvite.findUnique({
    where: { token },
    include: { business: true },
  });

  if (!invite || invite.expiresAt < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <p className="text-slate-600">This invitation has expired or is invalid.</p>
            <Link href="/login" className="mt-4 inline-block text-emerald-600 hover:underline">
              Go to login
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join {invite.business.name}</CardTitle>
          <p className="text-sm text-slate-500">
            You&apos;ve been invited as <strong>{invite.role}</strong>
          </p>
        </CardHeader>
        <CardContent>
          <AcceptInviteForm token={token} email={invite.email} />
        </CardContent>
      </Card>
    </div>
  );
}
