import { getBusinessId } from "@/lib/session";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getRentalMarketFeesSummary } from "@/lib/fees/rental-market";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RentalMarketFeeForm } from "@/components/fees/rental-market-fee-form";
import { DeleteFeeButton } from "@/components/fees/delete-fee-button";
import { Tent } from "lucide-react";
import Link from "next/link";

export default async function FeesPage() {
  const businessId = await getBusinessId();
  const summary = await getRentalMarketFeesSummary(businessId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Rental / Market fees
        </h1>
        <p className="text-slate-500">
          Stall hire, market pitch fees, and rentals — kept separate from supplies
          and COGS
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">Total fees logged</p>
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
              Bank import will suggest this category for stall / market / rental
              lines
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tent className="h-5 w-5 text-amber-700" />
            Add fee
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RentalMarketFeeForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fee history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {summary.recent.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              No rental or market fees yet
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
                  <DeleteFeeButton transactionId={t.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
