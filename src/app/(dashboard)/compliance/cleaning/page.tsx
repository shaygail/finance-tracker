import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComplianceForm, DeleteRecordButton } from "@/components/compliance/compliance-form";
import { ComplianceBackLink } from "@/components/compliance/back-link";
import {
  checkLabelClass,
  fieldClass,
  labelClass,
  toLocalDateTimeValue,
} from "@/components/compliance/field-styles";
import { addCleaningChecklist, deleteCleaningChecklist } from "../actions";
import { Sparkles } from "lucide-react";

export default async function CleaningPage() {
  const businessId = await getBusinessId();
  const rows = await db.cleaningChecklist.findMany({
    where: { businessId },
    orderBy: { cleanedAt: "desc" },
    take: 200,
  });

  const now = toLocalDateTimeValue();

  return (
    <div className="space-y-6">
      <ComplianceBackLink />
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cleaning & Sanitising Checklists</h1>
        <p className="text-slate-500">
          Daily diaries confirming benches, milk jugs, and espresso steam wands were cleaned and
          sanitised.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Complete today’s checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <ComplianceForm action={addCleaningChecklist} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="cleanedAt">
                Date & time
              </label>
              <input
                id="cleanedAt"
                name="cleanedAt"
                type="datetime-local"
                required
                defaultValue={now}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="recordedBy">
                Completed by
              </label>
              <input id="recordedBy" name="recordedBy" className={fieldClass} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <p className="text-sm font-medium text-slate-700">Areas completed</p>
              <label className={checkLabelClass}>
                <input type="checkbox" name="benches" defaultChecked className="rounded border-slate-300" />
                Benches cleaned & sanitised
              </label>
              <label className={checkLabelClass}>
                <input type="checkbox" name="milkJugs" defaultChecked className="rounded border-slate-300" />
                Milk jugs cleaned & sanitised
              </label>
              <label className={checkLabelClass}>
                <input type="checkbox" name="steamWands" defaultChecked className="rounded border-slate-300" />
                Espresso steam wands cleaned & sanitised
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="notes">
                Notes
              </label>
              <input id="notes" name="notes" className={fieldClass} />
            </div>
          </ComplianceForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            Checklist history ({rows.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 p-0">
          {rows.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-400">No checklists yet</p>
          ) : (
            rows.map((row) => {
              const done = [
                row.benches && "Benches",
                row.milkJugs && "Milk jugs",
                row.steamWands && "Steam wands",
              ].filter(Boolean);
              return (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {done.length ? done.join(" · ") : "No areas checked"}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatDateTime(row.cleanedAt)}
                      {row.recordedBy ? ` · ${row.recordedBy}` : ""}
                      {row.notes ? ` · ${row.notes}` : ""}
                    </p>
                  </div>
                  <DeleteRecordButton action={deleteCleaningChecklist} id={row.id} />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
