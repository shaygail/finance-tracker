import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function ComplianceBackLink() {
  return (
    <Link
      href="/compliance"
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-emerald-700"
    >
      <ArrowLeft className="h-4 w-4" />
      All council records
    </Link>
  );
}
