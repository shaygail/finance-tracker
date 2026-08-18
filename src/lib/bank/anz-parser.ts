/** ANZ Business Current Account statement parsing (PDF text or CSV). */

export interface AnzParsedMeta {
  accountNumber: string | null;
  statementNumber: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  openingBalance: number | null;
  closingBalance: number | null;
}

export interface AnzParsedLine {
  date: Date;
  txnType: string;
  description: string;
  withdrawal: number | null;
  deposit: number | null;
  balance: number | null;
  fingerprint: string;
}

export interface AnzParseResult {
  meta: AnzParsedMeta;
  lines: AnzParsedLine[];
  warnings: string[];
}

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const TXN_TYPES = new Set([
  "AP",
  "AT",
  "BP",
  "CQ",
  "DC",
  "DD",
  "ED",
  "EP",
  "FX",
  "IA",
  "IF",
  "IP",
  "VT",
]);

function parseMoney(raw: string): number {
  return Number(String(raw).replace(/[$,\s]/g, ""));
}

function fingerprintOf(
  date: Date,
  txnType: string,
  description: string,
  amount: number,
  side: "in" | "out"
): string {
  const day = date.toISOString().slice(0, 10);
  const desc = description.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
  return `${day}|${txnType}|${side}|${amount.toFixed(2)}|${desc}`;
}

function parsePeriodDates(text: string): {
  periodStart: Date | null;
  periodEnd: Date | null;
  yearHint: number | null;
} {
  const m = text.match(
    /Statement period\s+(\d{1,2}\s+\w+\s+\d{4})\s*[-–]\s*(\d{1,2}\s+\w+\s+\d{4})/i
  );
  if (!m) return { periodStart: null, periodEnd: null, yearHint: null };
  const periodStart = parseAnzDate(m[1], null);
  const periodEnd = parseAnzDate(m[2], null);
  return {
    periodStart,
    periodEnd,
    yearHint: periodEnd?.getFullYear() ?? periodStart?.getFullYear() ?? null,
  };
}

export function parseAnzDate(raw: string, yearHint: number | null): Date | null {
  const full = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (full) {
    const month = MONTHS[full[2].slice(0, 3).toLowerCase()];
    if (month == null) return null;
    return new Date(Date.UTC(Number(full[3]), month, Number(full[1])));
  }
  const short = raw.match(/^(\d{1,2})\s+([A-Za-z]+)$/);
  if (short && yearHint != null) {
    const month = MONTHS[short[2].slice(0, 3).toLowerCase()];
    if (month == null) return null;
    return new Date(Date.UTC(yearHint, month, Number(short[1])));
  }
  return null;
}

function extractMeta(text: string): AnzParsedMeta {
  const { periodStart, periodEnd } = parsePeriodDates(text);
  const account =
    text.match(/Account number\s+([0-9]{2}-[0-9]{4}-[0-9]{7}-[0-9]{2})/i)?.[1] ??
    null;
  const statementNumber =
    text.match(/Statement number\s+(\d+)/i)?.[1] ?? null;
  const opening = text.match(/Opening balance\s+([\d,]+\.\d{2})/i)?.[1];
  const closing = text.match(/Closing balance\s+([\d,]+\.\d{2})/i)?.[1];
  return {
    accountNumber: account,
    statementNumber,
    periodStart,
    periodEnd,
    openingBalance: opening ? parseMoney(opening) : null,
    closingBalance: closing ? parseMoney(closing) : null,
  };
}

/** Parse ANZ statement PDF text extraction. */
export function parseAnzStatementText(text: string): AnzParseResult {
  const warnings: string[] = [];
  const meta = extractMeta(text);
  const { yearHint } = parsePeriodDates(text);
  const year =
    yearHint ??
    meta.periodEnd?.getFullYear() ??
    meta.periodStart?.getFullYear() ??
    new Date().getFullYear();

  const lines: AnzParsedLine[] = [];
  let balance = meta.openingBalance;

  const rawLines = text.split(/\r?\n/).map((l) => l.replace(/\t/g, " ").trim());

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (!line) continue;
    if (/opening balance/i.test(line) && !/^\d{1,2}\s+\w+\s+Opening/i.test(line)) {
      continue;
    }
    if (/balance brought forward|totals at end|page \d+ of/i.test(line)) continue;
    if (/^(AP|AT|BP)\s+Automatic/i.test(line)) continue;

    // "30 Jun  Opening balance  222.34"
    const openingLine = line.match(
      /^(\d{1,2}\s+[A-Za-z]+)\s+Opening balance\s+([\d,]+\.\d{2})\s*$/i
    );
    if (openingLine) {
      balance = parseMoney(openingLine[2]);
      continue;
    }

    // Main txn: date + type + details + amount [+ balance]
    const m = line.match(
      /^(\d{1,2}\s+[A-Za-z]+)\s+([A-Z]{2})\s+(.+?)\s+([\d,]+\.\d{2})(?:\s+([\d,]+\.\d{2}))?\s*$/
    );
    if (!m) continue;
    const txnType = m[2];
    if (!TXN_TYPES.has(txnType)) continue;

    const date = parseAnzDate(m[1], year);
    if (!date) {
      warnings.push(`Could not parse date on: ${line.slice(0, 60)}`);
      continue;
    }

    const amount = parseMoney(m[4]);
    const endBalance = m[5] ? parseMoney(m[5]) : null;
    let description = m[3]
      .replace(/\s+/g, " ")
      .replace(/\s+Orig date\s+\d{2}\/\d{2}\/\d{4}/i, "")
      .trim();

    // Pull trailing card meta lines into description lightly — skip them as txns
    // (already ignored by regex)

    let withdrawal: number | null = null;
    let deposit: number | null = null;

    if (endBalance != null && balance != null) {
      const delta = Math.round((endBalance - balance) * 100) / 100;
      if (delta > 0) deposit = amount;
      else if (delta < 0) withdrawal = amount;
      else {
        // Zero delta rare — fall back to type heuristics
        if (txnType === "DC" || (txnType === "EP" && /fastpay|eftpos nz/i.test(description))) {
          deposit = amount;
        } else {
          withdrawal = amount;
        }
      }
      balance = endBalance;
    } else {
      // Heuristic without running balance
      if (
        txnType === "DC" ||
        (txnType === "EP" && /fastpay|eftpos nz/i.test(description)) ||
        (txnType === "BP" && /stll order|bill payment/i.test(description) && !/stall fee/i.test(description))
      ) {
        // BP is ambiguous — prefer deposit for person names + STLL ORDER, else check keywords
        if (txnType === "BP" && /stall fee|stall\b/i.test(description)) {
          withdrawal = amount;
        } else if (txnType === "BP" && /stll order|bill payment/i.test(description)) {
          deposit = amount;
        } else if (txnType === "BP") {
          deposit = amount; // many customer BPs
        } else {
          deposit = amount;
        }
      } else if (txnType === "VT" || txnType === "DD" || txnType === "AT" || txnType === "CQ") {
        withdrawal = amount;
      } else if (txnType === "EP") {
        withdrawal = amount; // merchant EP spend
      } else if (txnType === "BP") {
        withdrawal = amount;
      } else {
        deposit = amount;
      }
      if (endBalance != null) balance = endBalance;
    }

    // Refine BP using balance when available already done; fix customer BP labelled withdrawal wrongly:
    if (txnType === "BP" && /stll order/i.test(description) && withdrawal && !deposit) {
      deposit = withdrawal;
      withdrawal = null;
    }

    const side = deposit != null ? "in" : "out";
    const signed = deposit ?? withdrawal ?? amount;
    lines.push({
      date,
      txnType,
      description,
      withdrawal,
      deposit,
      balance: endBalance,
      fingerprint: fingerprintOf(date, txnType, description, signed, side),
    });
  }

  if (lines.length === 0) {
    warnings.push("No transactions found — try ANZ CSV export if PDF parsing failed");
  }

  return { meta, lines, warnings };
}

/** Parse a simple ANZ CSV export (flexible headers). */
export function parseAnzCsv(content: string): AnzParseResult {
  const warnings: string[] = [];
  const rows = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (rows.length < 2) {
    return {
      meta: {
        accountNumber: null,
        statementNumber: null,
        periodStart: null,
        periodEnd: null,
        openingBalance: null,
        closingBalance: null,
      },
      lines: [],
      warnings: ["CSV appears empty"],
    };
  }

  const split = (line: string) => {
    const cells: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        q = !q;
        continue;
      }
      if (ch === "," && !q) {
        cells.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  };

  const headers = split(rows[0]).map((h) => h.toLowerCase());
  const idx = (names: string[]) =>
    headers.findIndex((h) => names.some((n) => h.includes(n)));

  const dateIdx = idx(["date", "processed"]);
  const typeIdx = idx(["type", "txn"]);
  const detailsIdx = idx(["details", "description", "particulars", "narrative"]);
  const amountIdx = idx(["amount"]);
  const withdrawIdx = idx(["withdraw"]);
  const depositIdx = idx(["deposit", "credit"]);
  const balanceIdx = idx(["balance"]);

  if (dateIdx < 0 || (amountIdx < 0 && withdrawIdx < 0 && depositIdx < 0)) {
    return {
      meta: {
        accountNumber: null,
        statementNumber: null,
        periodStart: null,
        periodEnd: null,
        openingBalance: null,
        closingBalance: null,
      },
      lines: [],
      warnings: ["Unrecognised CSV headers — need Date and Amount (or Withdrawals/Deposits)"],
    };
  }

  const lines: AnzParsedLine[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = split(rows[r]);
    const dateRaw = cells[dateIdx] ?? "";
    let date: Date | null = null;
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateRaw)) {
      const [dd, mm, yyyy] = dateRaw.split("/").map(Number);
      date = new Date(Date.UTC(yyyy, mm - 1, dd));
    } else if (/^\d{4}-\d{2}-\d{2}/.test(dateRaw)) {
      date = new Date(dateRaw);
    } else {
      date = parseAnzDate(dateRaw, null);
    }
    if (!date || Number.isNaN(date.getTime())) continue;

    const description = (detailsIdx >= 0 ? cells[detailsIdx] : cells.slice(1).join(" "))
      .replace(/\s+/g, " ")
      .trim();
    const txnType = (typeIdx >= 0 ? cells[typeIdx] : "XX").toUpperCase().slice(0, 2) || "XX";

    let withdrawal: number | null = null;
    let deposit: number | null = null;
    if (withdrawIdx >= 0 || depositIdx >= 0) {
      if (withdrawIdx >= 0 && cells[withdrawIdx]) withdrawal = Math.abs(parseMoney(cells[withdrawIdx]));
      if (depositIdx >= 0 && cells[depositIdx]) deposit = Math.abs(parseMoney(cells[depositIdx]));
    } else if (amountIdx >= 0) {
      const amt = parseMoney(cells[amountIdx]);
      if (amt < 0) withdrawal = Math.abs(amt);
      else deposit = amt;
    }

    const balance = balanceIdx >= 0 && cells[balanceIdx] ? parseMoney(cells[balanceIdx]) : null;
    const side = deposit != null ? "in" : "out";
    const signed = deposit ?? withdrawal ?? 0;
    lines.push({
      date,
      txnType,
      description: description || "Bank transaction",
      withdrawal,
      deposit,
      balance,
      fingerprint: fingerprintOf(date, txnType, description || "Bank transaction", signed, side),
    });
  }

  const dates = lines.map((l) => l.date.getTime());
  const meta: AnzParsedMeta = {
    accountNumber: null,
    statementNumber: null,
    periodStart: dates.length ? new Date(Math.min(...dates)) : null,
    periodEnd: dates.length ? new Date(Math.max(...dates)) : null,
    openingBalance: null,
    closingBalance: lines.at(-1)?.balance ?? null,
  };

  if (lines.length === 0) warnings.push("No CSV data rows parsed");
  return { meta, lines, warnings };
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text ?? "";
}

export async function parseAnzStatementFile(
  buffer: Buffer,
  filename: string
): Promise<AnzParseResult> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    return parseAnzCsv(buffer.toString("utf8"));
  }
  if (lower.endsWith(".pdf")) {
    const text = await extractPdfText(buffer);
    return parseAnzStatementText(text);
  }
  // Try PDF then CSV
  try {
    const text = await extractPdfText(buffer);
    if (text.includes("Statement") || text.includes("EFTPOS")) {
      return parseAnzStatementText(text);
    }
  } catch {
    /* fall through */
  }
  return parseAnzCsv(buffer.toString("utf8"));
}
