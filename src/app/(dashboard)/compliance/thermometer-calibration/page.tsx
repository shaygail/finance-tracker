import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ComplianceForm, DeleteRecordButton } from "@/components/compliance/compliance-form";
import { ComplianceBackLink } from "@/components/compliance/back-link";
import {
  checkLabelClass,
  fieldClass,
  labelClass,
  toLocalDateTimeValue,
} from "@/components/compliance/field-styles";
import { addThermometerCalibration, deleteThermometerCalibration } from "../actions";
import { Gauge } from "lucide-react";

export default async function ThermometerCalibrationPage() {
  const businessId = await getBusinessId();
  const checks = await db.thermometerCalibration.findMany({
    where: { businessId },
    orderBy: { calibratedAt: "desc" },
    take: 200,
  });

  const now = toLocalDateTimeValue();

  return (
    <div className="space-y-6">
      <ComplianceBackLink />
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Thermometer Calibration Record</h1>
        <p className="text-slate-500">
          Calibrate your digital probe at least once a month using ice slurry (0°C) or boiling
          water (100°C).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Log a calibration</CardTitle>
        </CardHeader>
        <CardContent>
          <ComplianceForm
            action={addThermometerCalibration}
            className="grid gap-4 sm:grid-cols-2"
          >
            <div>
              <label className={labelClass} htmlFor="calibratedAt">
                Date & time
              </label>
              <input
                id="calibratedAt"
                name="calibratedAt"
                type="datetime-local"
                required
                defaultValue={now}
                className={fieldClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="method">
                Method
              </label>
              <select id="method" name="method" required className={fieldClass} defaultValue="ice_slurry">
                <option value="ice_slurry">Ice slurry (0°C)</option>
                <option value="boiling_water">Boiling water (100°C)</option>
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="readingC">
                Thermometer reading (°C)
              </label>
              <input
                id="readingC"
                name="readingC"
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
              <label className={checkLabelClass}>
                <input type="checkbox" name="passed" defaultChecked className="rounded border-slate-300" />
                Passed (within ±1°C of expected)
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
            <Gauge className="h-5 w-5 text-emerald-600" />
            Calibration history ({checks.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 p-0">
          {checks.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-slate-400">No calibrations yet</p>
          ) : (
            checks.map((check) => (
              <div
                key={check.id}
                className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">
                      {check.method === "ice_slurry" ? "Ice slurry" : "Boiling water"} ·{" "}
                      {check.readingC.toFixed(1)}°C
                    </p>
                    <Badge variant={check.passed ? "success" : "warning"}>
                      {check.passed ? "Passed" : "Failed"}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500">
                    {formatDateTime(check.calibratedAt)}
                    {check.recordedBy ? ` · ${check.recordedBy}` : ""}
                    {check.notes ? ` · ${check.notes}` : ""}
                  </p>
                </div>
                <DeleteRecordButton action={deleteThermometerCalibration} id={check.id} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
