import * as XLSX from "xlsx";

export interface CostingRow {
  date: string;
  purchases: string;
  amount: number;
  quantity: number;
  totalAmount: number;
  paymentMode: string;
  category: string;
  type: "expense" | "refund";
  warning?: string;
  rowNumber: number;
}

export interface CostingParseResult {
  rows: CostingRow[];
  errors: string[];
  warnings: string[];
}

const BUCKET_COLUMNS: Array<{ header: string; category: string }> = [
  { header: "Total Supplies", category: "Supplies" },
  { header: "Total COS", category: "Cost of Goods Sold" },
  { header: "Total Non Operating", category: "Non Operating" },
  { header: "Equipment/Tools", category: "Equipment & Tools" },
];

function normalizeHeader(h: string | undefined): string {
  return (h ?? "").trim().toLowerCase();
}

function extractHeaders(headerRow: unknown[]): string[] {
  const maxLen = headerRow.length;
  return Array.from({ length: maxLen }, (_, i) => String(headerRow[i] ?? ""));
}

function findColumnIndex(headers: string[], name: string): number {
  const target = normalizeHeader(name);
  return headers.findIndex((h) => normalizeHeader(h) === target);
}

export function detectCostingFormat(headers: string[]): boolean {
  return (
    findColumnIndex(headers, "Total Supplies") !== -1 &&
    findColumnIndex(headers, "Total COS") !== -1
  );
}

export function parseNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,\s]/g, "").trim();
    if (!cleaned) return 0;
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

export function parseDate(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const d = new Date(date.y, date.m - 1, date.d);
      return d.toISOString().split("T")[0];
    }
  }
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const part1 = parseInt(slashMatch[1], 10);
    const part2 = parseInt(slashMatch[2], 10);
    let year = parseInt(slashMatch[3], 10);
    if (year < 100) year += 2000;

    let day: number;
    let month: number;

    if (part1 > 12) {
      day = part1;
      month = part2;
    } else if (part2 > 12) {
      month = part1;
      day = part2;
    } else {
      day = part1;
      month = part2;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(year, month - 1, day);
    return d.toISOString().split("T")[0];
  }

  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }

  return null;
}

export function normalizePaymentMode(value: unknown): string {
  if (value === null || value === undefined) return "Other";
  let mode = String(value).trim().replace(/\s+/g, " ");
  if (!mode) return "Other";

  const lower = mode.toLowerCase();

  if (lower.includes("afterpay") || lower === "card/afterpay") {
    return "Card/AfterPay";
  }
  if (lower.includes("card")) return "Card";
  if (lower.includes("direct debit")) return "Direct Debit";
  if (lower === "cash") return "Cash";
  if (lower === "finance") return "Finance";
  if (lower.includes("eftpos")) return "EFTPOS";
  if (lower.includes("bank")) return "Bank Transfer";

  return mode
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function isRowEmpty(row: unknown[]): boolean {
  return row.every(
    (cell) =>
      cell === null ||
      cell === undefined ||
      String(cell).trim() === ""
  );
}

function getBucketValue(
  row: unknown[],
  headers: string[]
): { category: string; value: number } | null {
  for (const bucket of BUCKET_COLUMNS) {
    const idx = findColumnIndex(headers, bucket.header);
    if (idx === -1) continue;
    const val = parseNumber(row[idx]);
    if (val !== 0) {
      return { category: bucket.category, value: val };
    }
  }
  return null;
}

function hasAnyBucketValue(row: unknown[], headers: string[]): boolean {
  return getBucketValue(row, headers) !== null;
}

export function parseCostingCsvBuffer(buffer: Buffer): CostingParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return { rows: [], errors: ["No sheets found in workbook"], warnings: [] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  if (rawData.length < 2) {
    return {
      rows: [],
      errors: ["Sheet must have a header row and at least one data row"],
      warnings: [],
    };
  }

  const headers = extractHeaders(rawData[0] as unknown[]);

  if (!detectCostingFormat(headers)) {
    return {
      rows: [],
      errors: ["File does not match costing CSV format"],
      warnings: [],
    };
  }

  const colIndices = {
    date: findColumnIndex(headers, "Date"),
    purchases: findColumnIndex(headers, "Purchases"),
    amount: findColumnIndex(headers, "Amount"),
    quantity: findColumnIndex(headers, "Quantity"),
    totalAmount: findColumnIndex(headers, "Total Amount"),
    paymentMode: findColumnIndex(headers, "Mode of Payment"),
  };

  for (const [key, idx] of Object.entries(colIndices)) {
    if (idx === -1) {
      errors.push(`Missing column: ${key}`);
    }
  }

  if (errors.length > 0) {
    return { rows: [], errors, warnings: [] };
  }

  const rows: CostingRow[] = [];
  let lastDate: string | null = null;

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i] as unknown[];
    if (!row || isRowEmpty(row)) continue;

    const purchases = String(row[colIndices.purchases] ?? "").trim();
    const amount = parseNumber(row[colIndices.amount]);
    const bucket = getBucketValue(row, headers);

    if (!purchases) continue;

    const parsedDate = parseDate(row[colIndices.date]);
    if (parsedDate) {
      lastDate = parsedDate;
    }

    if (!lastDate) {
      errors.push(`Row ${i + 1}: missing date and no previous date to inherit`);
      continue;
    }

    const quantity = parseNumber(row[colIndices.quantity]) || 1;
    const totalAmountCol = parseNumber(row[colIndices.totalAmount]);
    let totalAmount =
      totalAmountCol !== 0
        ? totalAmountCol
        : amount !== 0
          ? amount * quantity
          : bucket?.value ?? 0;

    const isRefund = /refund/i.test(purchases);
    const type: "expense" | "refund" = isRefund ? "refund" : "expense";
    if (isRefund && totalAmount > 0) {
      totalAmount = -totalAmount;
    }

    let category = bucket?.category ?? "";
    let warning: string | undefined;

    if (!category) {
      if (purchases && amount !== 0) {
        category = "Uncategorised";
        warning = "No category bucket value; assigned as Uncategorised";
        warnings.push(`Row ${i + 1}: ${warning}`);
      } else if (hasAnyBucketValue(row, headers)) {
        continue;
      } else {
        continue;
      }
    }

    const unitAmount = amount !== 0 ? amount : totalAmount / quantity;

    rows.push({
      date: lastDate,
      purchases,
      amount: unitAmount,
      quantity,
      totalAmount,
      paymentMode: normalizePaymentMode(row[colIndices.paymentMode]),
      category,
      type,
      warning,
      rowNumber: i + 1,
    });
  }

  return { rows, errors, warnings };
}
