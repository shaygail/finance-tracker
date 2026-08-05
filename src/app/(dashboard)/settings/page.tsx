import { db } from "@/lib/db";
import { getBusinessId, requireSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings } from "lucide-react";

export default async function SettingsPage() {
  const session = await requireSession();
  const businessId = await getBusinessId();

  const business = await db.business.findUnique({
    where: { id: businessId },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500">Business configuration and account details</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-emerald-600" />
            Business Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-slate-500">Business Name</p>
              <p className="font-medium text-slate-900">{business?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">GST Number</p>
              <p className="font-medium text-slate-900">{business?.gstNumber ?? "Not set"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Balance Date</p>
              <p className="font-medium text-slate-900">{business?.balanceDate ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Financial Year Start</p>
              <p className="font-medium text-slate-900">{business?.financialYearStart ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">GST Filing Frequency</p>
              <p className="font-medium text-slate-900 capitalize">
                {business?.gstFilingFrequency?.replace("_", " ") ?? "—"}
              </p>
            </div>
          </div>
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
            Business settings editing is a placeholder in this demo. Connect to Xero or MYOB for
            full configuration in production.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">{session.user.name}</p>
              <p className="text-sm text-slate-500">{session.user.email}</p>
            </div>
            <Badge variant="default">{session.user.role}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
