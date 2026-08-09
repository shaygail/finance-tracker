import { requireOwner } from "@/lib/session";

export default async function ComplianceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireOwner();
  return children;
}
