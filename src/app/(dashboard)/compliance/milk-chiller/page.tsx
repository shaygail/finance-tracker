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
import { ThermometerSnowflake } from "lucide-react";

export default async function MilkChillerPage() {
  const businessId = await getBusinessId();
  const logs = await db.tempLog.findMany({
    where: { businessId, kind: "milk_chiller" },
    orderBy: { loggedAt: "desc" },
    take: 200,
  });

  const now = toLocalDateTimeValue();

  return (
    <div className="space-y-6">
      <ComplianceBackLink />
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Milk & Chiller Temperature Logs</h1>
        <p className="text-slate-500">
          Daily evidence that milk and high-risk ingredients stay at or below 5°C.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add temperature reading</CardTitle>
        </CardHeader>
        <CardContent>
          <ComplianceForm action={addTempLog} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="kind" value="milk_chiller" />
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
                Location
              </label>
              <input
                id="location"
                name="location"
                required
                placeholder="Cart fridge, home fridge…"
                className={fieldClass}
                list="milk-locations"
              />
              <datalist id="milk-locations">
                <option value="Cart fridge" />
                <option value="Home fridge" />
                <option value="Milk fridge" />
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
                placeholder="≤ 5.0"
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
            <ThermometerSnowflake className="h-5 w-5 text-emerald-600" />
            Log history ({logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 p-0">
          {logs.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-400">No readings yet</p>
          ) : (
            logs.map((log) => {
              const over = log.temperatureC > 5;
              return (
                <div
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {log.location}{" "}
                      <span className={over ? "text-red-600" : "text-emerald-700"}>
                        {log.temperatureC.toFixed(1)}°C
                      </span>
                      {over && (
                        <span className="ml-2 text-xs font-medium text-red-600">Above 5°C</span>
                      )}
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
                    extraFields={{ kind: "milk_chiller" }}
                  />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
