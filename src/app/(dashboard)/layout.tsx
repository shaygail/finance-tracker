import { requireSession, getBusinessId } from "@/lib/session";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { db } from "@/lib/db";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const businessId = await getBusinessId();
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { gstRegistered: true },
  });

  return (
    <DashboardShell
      isOwner={session.user.role === "owner"}
      gstRegistered={business?.gstRegistered ?? false}
    >
      {children}
    </DashboardShell>
  );
}
