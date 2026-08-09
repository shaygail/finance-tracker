import { requireSession } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <DashboardShell isOwner={session.user.role === "owner"}>
      {children}
    </DashboardShell>
  );
}
