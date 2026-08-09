import Link from "next/link";
import { requireOwner } from "@/lib/session";
import { COMPLIANCE_SECTIONS } from "@/lib/compliance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, ChevronRight } from "lucide-react";

export default async function ComplianceHubPage() {
  await requireOwner();

  const groups = COMPLIANCE_SECTIONS.reduce<
    Record<string, (typeof COMPLIANCE_SECTIONS)[number][]>
  >((acc, section) => {
    (acc[section.group] ??= []).push(section);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Council / FCP records</h1>
        <p className="text-slate-500">
          Keep daily operational logs, supplier proof, and staff safety records ready for council.
        </p>
      </div>

      {Object.entries(groups).map(([group, sections]) => (
        <div key={group} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {group}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {sections.map((section) => (
              <Link key={section.href} href={section.href} className="group block">
                <Card className="h-full transition-colors group-hover:border-emerald-300">
                  <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-emerald-100 p-2">
                        <ClipboardCheck className="h-4 w-4 text-emerald-700" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{section.title}</CardTitle>
                        <p className="mt-1 text-sm font-normal text-slate-500">
                          {section.blurb}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 group-hover:text-emerald-600" />
                  </CardHeader>
                  <CardContent className="pt-0" />
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
