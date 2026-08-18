"use server";

import { db } from "@/lib/db";
import { getBusinessId } from "@/lib/session";
import { parseAnzStatementFile } from "@/lib/bank/anz-parser";
import {
  suggestBankLineMatch,
  type BankLineAction,
  type ExpenseCandidate,
} from "@/lib/bank/match";
import { calculateGstFromInc } from "@/lib/gst/nz";
import { suggestCategory } from "@/lib/categorisation";
import { syncGoalsFromSurplus } from "@/lib/surplus";
import { ensureRentalMarketFeesCategory } from "@/lib/fees/rental-market";
import { ensureSubscriptionsCategory } from "@/lib/fees/subscriptions";
import { revalidatePath } from "next/cache";

const CATEGORY_NAME_TO_SLUG: Record<string, string> = {
  Supplies: "supplies",
  "Cost of Goods Sold": "cos",
  "Non Operating": "non-operating",
  "Equipment & Tools": "equipment-tools",
  "Rental / Market fees": "rental-market-fees",
  Subscriptions: "subscriptions",
};

export type BankPreviewLine = {
  lineIndex: number;
  date: string;
  txnType: string;
  description: string;
  withdrawal: number | null;
  deposit: number | null;
  balance: number | null;
  fingerprint: string;
  suggestedAction: BankLineAction;
  matchNote: string;
  matchedTransactionId: string | null;
  suggestedCategoryName: string | null;
  suggestedCategoryId: string | null;
  paymentMode: string;
  vendor: string;
  alreadyImported: boolean;
};

export async function previewBankStatement(formData: FormData) {
  const businessId = await getBusinessId();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { error: "No file uploaded", statementId: null as string | null, lines: [] as BankPreviewLine[], meta: null };
  }

  await ensureRentalMarketFeesCategory(businessId);
  await ensureSubscriptionsCategory(businessId);

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = await parseAnzStatementFile(buffer, file.name);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Failed to parse statement",
      statementId: null,
      lines: [],
      meta: null,
    };
  }

  if (parsed.lines.length === 0) {
    return {
      error: parsed.warnings.join("; ") || "No transactions found in file",
      statementId: null,
      lines: [],
      meta: null,
    };
  }

  const [expenses, categories, existingFingerprints] = await Promise.all([
    db.transaction.findMany({
      where: {
        businessId,
        type: { in: ["expense", "refund"] },
        date: {
          gte: parsed.meta.periodStart
            ? new Date(parsed.meta.periodStart.getTime() - 7 * 86400000)
            : undefined,
          lte: parsed.meta.periodEnd
            ? new Date(parsed.meta.periodEnd.getTime() + 7 * 86400000)
            : undefined,
        },
      },
      select: { id: true, date: true, vendor: true, totalAmount: true },
    }),
    db.category.findMany({ where: { businessId } }),
    db.bankStatementLine.findMany({
      where: {
        fingerprint: { in: parsed.lines.map((l) => l.fingerprint) },
        status: { in: ["imported", "linked", "skipped"] },
        statement: { businessId },
      },
      select: { fingerprint: true, status: true },
    }),
  ]);

  const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));
  const seenFp = new Set(existingFingerprints.map((f) => f.fingerprint));
  const usedExpenseIds = new Set<string>();
  const expenseCandidates: ExpenseCandidate[] = expenses;

  const statement = await db.bankStatement.create({
    data: {
      businessId,
      filename: file.name,
      accountNumber: parsed.meta.accountNumber,
      periodStart: parsed.meta.periodStart,
      periodEnd: parsed.meta.periodEnd,
      openingBalance: parsed.meta.openingBalance,
      closingBalance: parsed.meta.closingBalance,
      status: "draft",
    },
  });

  const previewLines: BankPreviewLine[] = [];

  for (let i = 0; i < parsed.lines.length; i++) {
    const line = parsed.lines[i];
    const suggestion = suggestBankLineMatch(line, expenseCandidates, usedExpenseIds);
    let suggestedCategoryId: string | null = null;
    if (suggestion.suggestedCategoryName) {
      const slug = CATEGORY_NAME_TO_SLUG[suggestion.suggestedCategoryName];
      suggestedCategoryId =
        (slug ? categoryBySlug.get(slug)?.id : null) ??
        categoryByName.get(suggestion.suggestedCategoryName.toLowerCase())?.id ??
        null;
    }

    const alreadyImported = seenFp.has(line.fingerprint);

    await db.bankStatementLine.create({
      data: {
        statementId: statement.id,
        lineIndex: i,
        date: line.date,
        txnType: line.txnType,
        description: line.description,
        withdrawal: line.withdrawal,
        deposit: line.deposit,
        balance: line.balance,
        fingerprint: line.fingerprint,
        suggestedAction: alreadyImported ? "skip" : suggestion.action,
        suggestedCategoryId,
        matchedTransactionId: suggestion.matchedTransactionId,
        matchNote: alreadyImported
          ? "Already imported from a previous statement"
          : suggestion.matchNote,
        status: "pending",
      },
    });

    previewLines.push({
      lineIndex: i,
      date: line.date.toISOString(),
      txnType: line.txnType,
      description: line.description,
      withdrawal: line.withdrawal,
      deposit: line.deposit,
      balance: line.balance,
      fingerprint: line.fingerprint,
      suggestedAction: alreadyImported ? "skip" : suggestion.action,
      matchNote: alreadyImported
        ? "Already imported from a previous statement"
        : suggestion.matchNote,
      matchedTransactionId: suggestion.matchedTransactionId,
      suggestedCategoryName: suggestion.suggestedCategoryName,
      suggestedCategoryId,
      paymentMode: suggestion.paymentMode,
      vendor: suggestion.vendor,
      alreadyImported,
    });
  }

  revalidatePath("/bank-statements");

  return {
    error: null as string | null,
    statementId: statement.id,
    warnings: parsed.warnings as string[],
    meta: {
      filename: file.name,
      accountNumber: parsed.meta.accountNumber,
      periodStart: parsed.meta.periodStart?.toISOString() ?? null,
      periodEnd: parsed.meta.periodEnd?.toISOString() ?? null,
      openingBalance: parsed.meta.openingBalance,
      closingBalance: parsed.meta.closingBalance,
      lineCount: previewLines.length,
    },
    lines: previewLines,
  };
}

export type ApplyLineDecision = {
  lineIndex: number;
  action: BankLineAction;
};

export async function applyBankStatement(
  statementId: string,
  decisions: ApplyLineDecision[]
) {
  const businessId = await getBusinessId();
  const statement = await db.bankStatement.findFirst({
    where: { id: statementId, businessId },
    include: { lines: { orderBy: { lineIndex: "asc" } } },
  });
  if (!statement) return { error: "Statement not found", imported: 0, skipped: 0, linked: 0 };

  const decisionMap = new Map(decisions.map((d) => [d.lineIndex, d.action]));

  let imported = 0;
  let skipped = 0;
  let linked = 0;

  for (const line of statement.lines) {
    if (line.status !== "pending") continue;
    const action = decisionMap.get(line.lineIndex) ?? (line.suggestedAction as BankLineAction);

    if (
      action === "skip_income" ||
      action === "skip_afterpay" ||
      action === "skip" ||
      action === "review"
    ) {
      // "review" left as skip unless user changed it — treat unresolved review as skip
      await db.bankStatementLine.update({
        where: { id: line.id },
        data: { status: "skipped", suggestedAction: action },
      });
      skipped++;
      continue;
    }

    if (action === "match_expense" && line.matchedTransactionId) {
      await db.bankStatementLine.update({
        where: { id: line.id },
        data: {
          status: "linked",
          appliedTransactionId: line.matchedTransactionId,
          suggestedAction: action,
        },
      });
      linked++;
      continue;
    }

    if (action === "new_expense" || action === "match_expense") {
      const amount = line.withdrawal;
      if (amount == null || amount <= 0) {
        await db.bankStatementLine.update({
          where: { id: line.id },
          data: { status: "skipped", matchNote: "No withdrawal amount to import" },
        });
        skipped++;
        continue;
      }

      const vendor =
        line.description.replace(/\s+/g, " ").trim().slice(0, 120) || "Bank transaction";
      let categoryId = line.suggestedCategoryId;
      if (!categoryId) {
        const suggestion = await suggestCategory(businessId, vendor);
        categoryId = suggestion?.categoryId ?? null;
      }

      const gst = calculateGstFromInc(amount);
      const paymentMode =
        /afterpay/i.test(line.description)
          ? "Card/AfterPay"
          : line.txnType === "VT"
            ? "Credit Card"
            : line.txnType === "DD"
              ? "Direct Debit"
              : line.txnType === "EP"
                ? "EFTPOS"
                : "Bank Transfer";

      const tx = await db.transaction.create({
        data: {
          businessId,
          categoryId,
          date: line.date,
          vendor,
          unitAmount: amount,
          quantity: 1,
          totalAmount: amount,
          paymentMode,
          amountExGst: gst.amountExGst,
          gstAmount: gst.gstAmount,
          amountIncGst: gst.amountIncGst,
          gstType: "standard_15",
          type: "expense",
          source: "bank",
          notes: `ANZ ${line.txnType} · ${statement.filename}`,
        },
      });

      await db.bankStatementLine.update({
        where: { id: line.id },
        data: {
          status: "imported",
          appliedTransactionId: tx.id,
          suggestedAction: "new_expense",
        },
      });
      imported++;
    }
  }

  await db.bankStatement.update({
    where: { id: statement.id },
    data: { status: "applied" },
  });

  await syncGoalsFromSurplus(businessId);
  revalidatePath("/bank-statements");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/goals");

  return { error: null as string | null, imported, skipped, linked };
}
