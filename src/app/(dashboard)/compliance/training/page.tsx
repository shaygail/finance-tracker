import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { formatDateUtc } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ComplianceForm, DeleteRecordButton } from "@/components/compliance/compliance-form";
import { ComplianceBackLink } from "@/components/compliance/back-link";
import {
  checkLabelClass,
  fieldClass,
  labelClass,
  toLocalDateValue,
} from "@/components/compliance/field-styles";
import { addTrainingSignOff, deleteTrainingSignOff } from "../actions";
import { GraduationCap } from "lucide-react";

export default async function TrainingPage() {
  const businessId = await getBusinessId();
  const rows = await db.trainingSignOff.findMany({
    where: { businessId },
    orderBy: { signedAt: "desc" },
    take: 200,
  });

  const today = toLocalDateValue();

  return (
    <div className="space-y-6">
      <ComplianceBackLink />
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Training Sign-Off</h1>
        <p className="text-slate-500">
          Records that you and any part-time staff or family helpers have read, understood, and
          signed off on the Food Control Plan (FCP) rules.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add sign-off</CardTitle>
        </CardHeader>
        <CardContent>
          <ComplianceForm action={addTrainingSignOff} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="personName">
                Name
              </label>
              <input id="personName" name="personName" required className={fieldClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="personRole">
                Role
              </label>
              <select id="personRole" name="personRole" className={fieldClass} defaultValue="owner">
                <option value="owner">Owner</option>
                <option value="staff">Part-time staff</option>
                <option value="family_helper">Family helper</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="signedAt">
                Sign-off date
              </label>
              <input
                id="signedAt"
                name="signedAt"
                type="date"
                required
                defaultValue={today}
                className={fieldClass}
              />
            </div>
            <div className="flex items-end pb-2">
              <label className={checkLabelClass}>
                <input
                  type="checkbox"
                  name="acknowledgedFcp"
                  defaultChecked
                  className="rounded border-slate-300"
                />
                I have read and understood the FCP rules
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
            <GraduationCap className="h-5 w-5 text-emerald-600" />
            Sign-offs ({rows.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 p-0">
          {rows.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-400">No training sign-offs yet</p>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{row.personName}</p>
                    <Badge variant="muted">{row.personRole.replace(/_/g, " ")}</Badge>
                    {row.acknowledgedFcp && <Badge variant="success">FCP acknowledged</Badge>}
                  </div>
                  <p className="text-sm text-slate-500">
                    {formatDateUtc(row.signedAt)}
                    {row.notes ? ` · ${row.notes}` : ""}
                  </p>
                </div>
                <DeleteRecordButton action={deleteTrainingSignOff} id={row.id} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
