import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BankStatementUploader } from "@/components/bank/bank-statement-uploader";
import { Landmark } from "lucide-react";

export default async function BankStatementsPage() {
  const businessId = await getBusinessId();
  const recent = await db.bankStatement.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: 15,
    include: {
      _count: { select: { lines: true } },
      lines: {
        select: { status: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bank statements</h1>
        <p className="text-slate-500">
          Import ANZ statements for <span className="font-medium text-slate-700">deductions only</span>
          {" "}(expenses / money out). Sales revenue always comes from POS — deposits are skipped.
        </p>
      </div>

      <BankStatementUploader />

      {recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-slate-600" />
              Recent uploads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100">
              {recent.map((s) => {
                const imported = s.lines.filter((l) => l.status === "imported").length;
                const linked = s.lines.filter((l) => l.status === "linked").length;
                const skipped = s.lines.filter((l) => l.status === "skipped").length;
                return (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{s.filename}</p>
                      <p className="text-sm text-slate-500">
                        {formatDate(s.createdAt)}
                        {s.accountNumber ? ` · ${s.accountNumber}` : ""}
                        {` · ${s._count.lines} lines`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={s.status === "applied" ? "default" : "muted"}>
                        {s.status}
                      </Badge>
                      {s.status === "applied" && (
                        <span className="text-xs text-slate-500">
                          {imported} new · {linked} linked · {skipped} skipped
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
