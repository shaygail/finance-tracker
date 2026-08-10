import { db } from "@/lib/db";
import { getBusinessId, requireSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Users, Database, Trash2, Scale } from "lucide-react";
import { InviteAccountantForm } from "@/components/settings/invite-form";
import { PosSyncPanel } from "@/components/settings/pos-sync-panel";
import { ResetFinanceDataPanel } from "@/components/settings/reset-finance-data-panel";
import { GstRegistrationPanel } from "@/components/settings/gst-registration-panel";
import { getPosStatus } from "@/lib/pos/sync";

export default async function SettingsPage() {
  const session = await requireSession();
  const businessId = await getBusinessId();

  const [business, members, invites, posStatus] = await Promise.all([
    db.business.findUnique({ where: { id: businessId } }),
    db.businessMember.findMany({
      where: { businessId },
      include: { user: true },
    }),
    db.businessInvite.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
    }),
    getPosStatus(businessId),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500">Business configuration and team access</p>
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
              <p className="text-sm text-slate-500">GST Filing Frequency</p>
              <p className="font-medium capitalize text-slate-900">
                {business?.gstFilingFrequency?.replace("_", " ") ?? "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-emerald-600" />
            GST registration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <GstRegistrationPanel
            registered={business?.gstRegistered ?? false}
            gstNumber={business?.gstNumber ?? null}
            canEdit={session.user.role === "owner"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-emerald-600" />
            POS Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PosSyncPanel
            configured={posStatus.configured}
            syncEnabled={posStatus.syncEnabled}
            lastSyncedAt={posStatus.lastSyncedAt?.toISOString() ?? null}
            saleCount={posStatus.saleCount}
            lastLogStatus={posStatus.lastLog?.status}
            lastLogMessage={posStatus.lastLog?.message}
          />
        </CardContent>
      </Card>

      {session.user.role === "owner" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Reset finance data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResetFinanceDataPanel />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-600" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="divide-y divide-slate-100">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-slate-900">{m.user.name}</p>
                  <p className="text-sm text-slate-500">{m.user.email}</p>
                </div>
                <Badge variant="default">{m.role}</Badge>
              </li>
            ))}
          </ul>

          {invites.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Pending invites</p>
              <ul className="space-y-1 text-sm text-slate-500">
                {invites.map((inv) => (
                  <li key={inv.id}>
                    {inv.email} — expires {inv.expiresAt.toLocaleDateString("en-NZ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {session.user.role === "owner" && (
            <div className="border-t border-slate-100 pt-4">
              <p className="mb-3 text-sm font-medium text-slate-700">Invite accountant</p>
              <InviteAccountantForm />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Account</CardTitle>
        </CardHeader>
        <CardContent>
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
