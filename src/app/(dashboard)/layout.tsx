import { requireSession } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();

  return <DashboardShell>{children}</DashboardShell>;
}
