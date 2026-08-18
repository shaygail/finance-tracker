import { getBusinessId } from "@/lib/session";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getSubscriptionsSummary } from "@/lib/fees/subscriptions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionForm } from "@/components/subscriptions/subscription-form";
import { DeleteSubscriptionButton } from "@/components/subscriptions/delete-subscription-button";
import { Repeat } from "lucide-react";
import Link from "next/link";

export default async function SubscriptionsPage() {
  const businessId = await getBusinessId();
  const summary = await getSubscriptionsSummary(businessId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Subscriptions</h1>
        <p className="text-slate-500">
          Domain, email, Cursor, hosting, and other software / SaaS plans
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Total logged</p>
            <p className="text-2xl font-bold text-slate-900">
              {formatCurrency(summary.total)}
            </p>
            <p className="text-sm text-slate-500">
              {summary.count} entr{summary.count === 1 ? "y" : "ies"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex h-full flex-col justify-center gap-2 pt-6">
            <p className="text-sm text-slate-500">Also appears under</p>
            <Link
              href={`/transactions?categoryId=${summary.categoryId}`}
              className="text-sm font-medium text-emerald-700 hover:underline"
            >
              Transactions → {summary.categoryName}
            </Link>
            <p className="text-xs text-slate-400">
              Bank import suggests this category for Cursor, domains, Workspace,
              hosting, etc.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5 text-sky-700" />
            Add subscription payment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SubscriptionForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscription history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {summary.recent.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              No subscriptions logged yet — add Cursor, domain renewals, email,
              hosting, etc.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {summary.recent.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {t.vendor} · {formatDate(t.date)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatCurrency(t.totalAmount)}
                      {t.notes ? ` · ${t.notes}` : ""}
                    </p>
                  </div>
                  <DeleteSubscriptionButton transactionId={t.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
