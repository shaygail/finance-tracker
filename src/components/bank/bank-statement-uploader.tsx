"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Landmark, CheckCircle, AlertTriangle } from "lucide-react";
import {
  previewBankStatement,
  applyBankStatement,
  type BankPreviewLine,
  type ApplyLineDecision,
} from "@/app/(dashboard)/bank-statements/actions";
import type { BankLineAction } from "@/lib/bank/match";
import { formatCurrency } from "@/lib/utils";

const ACTIONS: { value: BankLineAction; label: string }[] = [
  { value: "new_expense", label: "New expense" },
  { value: "match_expense", label: "Link expense" },
  { value: "skip_income", label: "Skip (income)" },
  { value: "skip_afterpay", label: "Skip (Afterpay)" },
  { value: "skip", label: "Skip" },
  { value: "review", label: "Skip (review later)" },
];

type Meta = {
  filename: string;
  accountNumber: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  openingBalance: number | null;
  closingBalance: number | null;
  lineCount: number;
};

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function BankStatementUploader() {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [statementId, setStatementId] = useState<string | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [lines, setLines] = useState<BankPreviewLine[]>([]);
  const [actions, setActions] = useState<Record<number, BankLineAction>>({});

  const counts = useMemo(() => {
    const c = {
      new_expense: 0,
      match_expense: 0,
      skip: 0,
      review: 0,
    };
    for (const line of lines) {
      const a = actions[line.lineIndex] ?? line.suggestedAction;
      if (a === "new_expense") c.new_expense++;
      else if (a === "match_expense") c.match_expense++;
      else if (a === "review") c.review++;
      else c.skip++;
    }
    return c;
  }, [lines, actions]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setWarnings([]);

    const formData = new FormData();
    formData.append("file", file);
    const result = await previewBankStatement(formData);
    setLoading(false);

    if (result.error || !result.statementId) {
      setError(result.error ?? "Preview failed");
      setLines([]);
      setStatementId(null);
      setMeta(null);
      return;
    }

    setStatementId(result.statementId);
    setMeta(result.meta);
    setLines(result.lines);
    setWarnings(result.warnings ?? []);
    const initial: Record<number, BankLineAction> = {};
    for (const line of result.lines) {
      initial[line.lineIndex] = line.suggestedAction;
    }
    setActions(initial);
  }

  function setAction(lineIndex: number, action: BankLineAction) {
    setActions((prev) => ({ ...prev, [lineIndex]: action }));
  }

  async function handleApply() {
    if (!statementId) return;
    setApplying(true);
    setError(null);
    setSuccess(null);

    const decisions: ApplyLineDecision[] = lines.map((line) => ({
      lineIndex: line.lineIndex,
      action: actions[line.lineIndex] ?? line.suggestedAction,
    }));

    const result = await applyBankStatement(statementId, decisions);
    setApplying(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(
      `Done — ${result.imported} expense${result.imported === 1 ? "" : "s"} created, ${result.linked} linked, ${result.skipped} skipped`
    );
    setLines([]);
    setStatementId(null);
    setMeta(null);
    setActions({});
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-emerald-600" />
            Upload ANZ statement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">
            Upload an ANZ <strong>PDF</strong> statement or <strong>CSV</strong> export.
            Incoming sales settlements are skipped; withdrawals can become expenses or
            link to ones you already entered. Afterpay instalments are skipped.
          </p>
          <input
            type="file"
            accept=".pdf,.csv,.txt,application/pdf,text/csv"
            onChange={handleFile}
            disabled={loading || applying}
            className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-emerald-700 hover:file:bg-emerald-100"
          />
          {loading && <p className="text-sm text-slate-500">Parsing statement…</p>}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {success}
            </div>
          )}
          {warnings.length > 0 && (
            <ul className="list-inside list-disc text-sm text-amber-700">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {meta && lines.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-slate-500">Account</p>
                <p className="font-medium text-slate-900">
                  {meta.accountNumber ?? "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-slate-500">Period</p>
                <p className="font-medium text-slate-900">
                  {meta.periodStart ? formatDay(meta.periodStart) : "—"}
                  {" – "}
                  {meta.periodEnd ? formatDay(meta.periodEnd) : "—"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-slate-500">Lines</p>
                <p className="font-medium text-slate-900">{meta.lineCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-slate-500">Will create / link / skip</p>
                <p className="font-medium text-slate-900">
                  {counts.new_expense} / {counts.match_expense} /{" "}
                  {counts.skip + counts.review}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-slate-700" />
                Match queue
              </CardTitle>
              <Button onClick={handleApply} disabled={applying}>
                {applying ? "Applying…" : "Apply decisions"}
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-500">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Bank line</th>
                    <th className="px-4 py-3 font-medium text-right">Out</th>
                    <th className="px-4 py-3 font-medium text-right">In</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Match note</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const action = actions[line.lineIndex] ?? line.suggestedAction;
                    return (
                      <tr
                        key={line.lineIndex}
                        className="border-b border-slate-50 align-top"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {formatDay(line.date)}
                          <div className="text-xs text-slate-400">{line.txnType}</div>
                        </td>
                        <td className="max-w-[220px] px-4 py-3">
                          <p className="font-medium text-slate-900 line-clamp-2">
                            {line.vendor}
                          </p>
                          <p className="text-xs text-slate-500 line-clamp-2">
                            {line.description}
                          </p>
                          {line.alreadyImported && (
                            <Badge variant="muted" className="mt-1">
                              Already imported
                            </Badge>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-slate-900">
                          {line.withdrawal != null
                            ? formatCurrency(line.withdrawal)
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-emerald-700">
                          {line.deposit != null ? formatCurrency(line.deposit) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            className="w-full max-w-[160px] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                            value={action}
                            onChange={(e) =>
                              setAction(
                                line.lineIndex,
                                e.target.value as BankLineAction
                              )
                            }
                          >
                            {ACTIONS.map((a) => (
                              <option key={a.value} value={a.value}>
                                {a.label}
                              </option>
                            ))}
                          </select>
                          {line.suggestedCategoryName &&
                            action === "new_expense" && (
                              <p className="mt-1 text-xs text-slate-500">
                                Category: {line.suggestedCategoryName}
                              </p>
                            )}
                        </td>
                        <td className="max-w-[240px] px-4 py-3 text-xs text-slate-600">
                          {line.matchNote}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
