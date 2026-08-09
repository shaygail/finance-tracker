import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComplianceForm, DeleteRecordButton } from "@/components/compliance/compliance-form";
import { ComplianceBackLink } from "@/components/compliance/back-link";
import {
  fieldClass,
  labelClass,
  toLocalDateTimeValue,
} from "@/components/compliance/field-styles";
import { addTempLog, deleteTempLog } from "../actions";
import { Truck } from "lucide-react";

export default async function TransportTempPage() {
  const businessId = await getBusinessId();
  const logs = await db.tempLog.findMany({
    where: { businessId, kind: "transport" },
    orderBy: { loggedAt: "desc" },
    take: 200,
  });

  const now = toLocalDateTimeValue();

  return (
    <div className="space-y-6">
      <ComplianceBackLink />
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Transport Temperature Proof</h1>
        <p className="text-slate-500">
          Logs showing food temperature was maintained while moving from home prep to the cart
          (e.g. chilly bins with ice packs).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add transport check</CardTitle>
        </CardHeader>
        <CardContent>
          <ComplianceForm action={addTempLog} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="kind" value="transport" />
            <div>
              <label className={labelClass} htmlFor="loggedAt">
                Date & time
              </label>
              <input
                id="loggedAt"
                name="loggedAt"
                type="datetime-local"
                required
                defaultValue={now}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="location">
                Container / stage
              </label>
              <input
                id="location"
                name="location"
                required
                placeholder="Chilly bin, departing home, arriving cart…"
                className={fieldClass}
                list="transport-locations"
              />
              <datalist id="transport-locations">
                <option value="Chilly bin — departing home" />
                <option value="Chilly bin — arriving cart" />
                <option value="Insulated bag" />
              </datalist>
            </div>
            <div>
              <label className={labelClass} htmlFor="temperatureC">
                Temperature (°C)
              </label>
              <input
                id="temperatureC"
                name="temperatureC"
                type="number"
                step="0.1"
                required
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="recordedBy">
                Recorded by
              </label>
              <input id="recordedBy" name="recordedBy" className={fieldClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="notes">
                Notes (ice packs used, travel time…)
              </label>
              <input id="notes" name="notes" className={fieldClass} />
            </div>
          </ComplianceForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-emerald-600" />
            Transport log ({logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 p-0">
          {logs.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-400">No transport logs yet</p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {log.location} · {log.temperatureC.toFixed(1)}°C
                  </p>
                  <p className="text-sm text-slate-500">
                    {formatDateTime(log.loggedAt)}
                    {log.recordedBy ? ` · ${log.recordedBy}` : ""}
                    {log.notes ? ` · ${log.notes}` : ""}
                  </p>
                </div>
                <DeleteRecordButton
                  action={deleteTempLog}
                  id={log.id}
                  extraFields={{ kind: "transport" }}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
