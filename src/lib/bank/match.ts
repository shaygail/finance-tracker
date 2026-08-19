import type { AnzParsedLine } from "./anz-parser";

export type BankLineAction =
  | "skip_income"
  | "skip_afterpay"
  | "skip"
  | "match_expense"
  | "new_expense"
  | "review";

export interface ExpenseCandidate {
  id: string;
  date: Date;
  vendor: string;
  totalAmount: number;
}

export interface BankMatchSuggestion {
  action: BankLineAction;
  matchNote: string;
  matchedTransactionId: string | null;
  suggestedCategoryName: string | null;
  paymentMode: string;
  vendor: string;
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

function vendorFromDescription(description: string, txnType: string): string {
  let d = description
    .replace(/\b\d{6,}\b/g, " ")
    .replace(/\b403736\*+\d+\b/gi, " ")
    .replace(/\bOrig date\s+\d{2}\/\d{2}\/\d{4}\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (txnType === "EP" && /EFTPOS NZ/i.test(d)) return "EFTPOS NZ FASTPAY";
  if (/UBER BV/i.test(d)) return "Uber Eats payout";
  if (/^Afterpay\b/i.test(d)) return "Afterpay";

  // Take leading merchant tokens
  const parts = d.split(" ").filter(Boolean);
  if (parts.length <= 4) return d.slice(0, 80);
  return parts.slice(0, 4).join(" ").slice(0, 80);
}

function paymentModeFor(line: AnzParsedLine): string {
  const d = line.description.toLowerCase();
  if (d.includes("afterpay")) return "Card/AfterPay";
  if (line.txnType === "VT") return "Credit Card";
  if (line.txnType === "DD") return "Direct Debit";
  if (line.txnType === "EP") return "EFTPOS";
  if (line.txnType === "BP" || line.txnType === "DC") return "Bank Transfer";
  if (line.txnType === "AT" || line.txnType === "CQ") return "Cash";
  return "Other";
}

function categoryHint(description: string): string | null {
  const d = description.toLowerCase();
  if (
    /\bstall\b/.test(d) ||
    /\bmarket\b/.test(d) ||
    /\brental\b/.test(d) ||
    /\brent\b/.test(d) ||
    /\bpitch\b/.test(d) ||
    /\bsite fee\b/.test(d)
  ) {
    return "Rental / Market fees";
  }
  if (
    /\bcursor\b/.test(d) ||
    /\bdomain\b/.test(d) ||
    /\bgodaddy\b/.test(d) ||
    /\bnamecheap\b/.test(d) ||
    /\bcloudflare\b/.test(d) ||
    /\bworkspace\b/.test(d) ||
    /\bgsuite\b/.test(d) ||
    /\bmicrosoft 365\b/.test(d) ||
    /\boffice 365\b/.test(d) ||
    /\brailway\b/.test(d) ||
    /\bvercel\b/.test(d) ||
    /\bnetlify\b/.test(d) ||
    /\bgithub\b/.test(d) ||
    /\bopenai\b/.test(d) ||
    /\bchatgpt\b/.test(d) ||
    /\banthropic\b/.test(d) ||
    /\bnotion\b/.test(d) ||
    /\bcanva\b/.test(d) ||
    /\badobe\b/.test(d) ||
    /\bhosting\b/.test(d) ||
    /\bsubscription\b/.test(d)
  ) {
    return "Subscriptions";
  }
  if (/bidfood|taranaki milk|anchor|pak.?n.?save|woolworths|new world|fresh world|pinoy|ez asian|pack centre/.test(d)) {
    return "Cost of Goods Sold";
  }
  if (/waste manage|aitken|anz merch|anz cards|facility fee|mrch charges/.test(d)) {
    return "Non Operating";
  }
  if (/noel leeming|look sharp/.test(d)) return "Equipment & Tools";
  if (/woolworths|pak.?n.?save|fresh world/.test(d)) return "Supplies";
  return null;
}

function findExpenseMatch(
  line: AnzParsedLine,
  expenses: ExpenseCandidate[],
  usedIds: Set<string>
): ExpenseCandidate | null {
  const amount = line.withdrawal;
  if (amount == null) return null;

  let best: ExpenseCandidate | null = null;
  let bestScore = Infinity;

  for (const exp of expenses) {
    if (usedIds.has(exp.id)) continue;
    if (Math.abs(exp.totalAmount - amount) > 0.05) continue;
    const days = daysBetween(exp.date, line.date);
    if (days > 5) continue;

    const vendorBits = vendorFromDescription(line.description, line.txnType)
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const expVendor = exp.vendor.toLowerCase();
    const nameHit = vendorBits.some((w) => expVendor.includes(w));
    const score = days + (nameHit ? 0 : 2);
    if (score < bestScore) {
      bestScore = score;
      best = exp;
    }
  }
  return best;
}

export function suggestBankLineMatch(
  line: AnzParsedLine,
  expenses: ExpenseCandidate[],
  usedExpenseIds: Set<string>
): BankMatchSuggestion {
  const vendor = vendorFromDescription(line.description, line.txnType);
  const paymentMode = paymentModeFor(line);
  const desc = line.description.toLowerCase();

  if (line.deposit != null && line.deposit > 0) {
    return {
      action: "skip_income",
      matchNote:
        "Money in — sales come from POS only (statements are for deductions)",
      matchedTransactionId: null,
      suggestedCategoryName: null,
      paymentMode,
      vendor,
    };
  }

  if (/^afterpay\b/i.test(desc) || desc.includes("afterpay")) {
    return {
      action: "skip_afterpay",
      matchNote: "Afterpay instalment — skip (log the original purchase instead)",
      matchedTransactionId: null,
      suggestedCategoryName: null,
      paymentMode: "Card/AfterPay",
      vendor: "Afterpay",
    };
  }

  if (/vending\s*dire|mcdonald|kfc |western\s*unio/i.test(desc)) {
    return {
      action: "new_expense",
      matchNote: "Personal drawings — owner money out (not a business cost)",
      matchedTransactionId: null,
      suggestedCategoryName: "Personal",
      paymentMode,
      vendor,
    };
  }

  if (/temu\.com|escape coffe/i.test(desc)) {
    return {
      action: "review",
      matchNote: "Possible personal / non-trading spend — confirm before importing",
      matchedTransactionId: null,
      suggestedCategoryName: categoryHint(desc),
      paymentMode,
      vendor,
    };
  }

  const match = findExpenseMatch(line, expenses, usedExpenseIds);
  if (match) {
    usedExpenseIds.add(match.id);
    return {
      action: "match_expense",
      matchNote: `Matches existing expense: ${match.vendor} · $${match.totalAmount.toFixed(2)}`,
      matchedTransactionId: match.id,
      suggestedCategoryName: null,
      paymentMode,
      vendor,
    };
  }

  return {
    action: "new_expense",
    matchNote: "No matching expense found — create from this bank line",
    matchedTransactionId: null,
    suggestedCategoryName: categoryHint(desc),
    paymentMode,
    vendor,
  };
}
