import * as XLSX from "xlsx";
import {
  detectCostingFormat,
  parseCostingCsvBuffer,
} from "./costing-parser";

export interface ExcelRow {
  date: string;
  purchases: string;
  amount: number;
  quantity: number;
  totalAmount: number;
  paymentMode: string;
  category: string;
  type?: "expense" | "refund";
  warning?: string;
  rowNumber?: number;
}

export interface ParseResult {
  rows: ExcelRow[];
  errors: string[];
  warnings?: string[];
}

const EXPECTED_COLUMNS = [
  "Date",
  "Purchases",
  "Amount",
  "Quantity",
  "Total Amount",
  "Mode of Payment",
  "Category",
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

function parseNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,]/g, "").trim();
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function parseDate(value: unknown): string {
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
  if (typeof value === "string") {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }
    return value;
  }
  return new Date().toISOString().split("T")[0];
}

function parseStandardBuffer(buffer: Buffer): ParseResult {
  const errors: string[] = [];
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return { rows: [], errors: ["No sheets found in workbook"] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  if (rawData.length < 2) {
    return {
      rows: [],
      errors: ["Sheet must have a header row and at least one data row"],
    };
  }

  const headers = extractHeaders(rawData[0] as unknown[]);

  const colIndices = {
    date: findColumnIndex(headers, "Date"),
    purchases: findColumnIndex(headers, "Purchases"),
    amount: findColumnIndex(headers, "Amount"),
    quantity: findColumnIndex(headers, "Quantity"),
    totalAmount: findColumnIndex(headers, "Total Amount"),
    paymentMode: findColumnIndex(headers, "Mode of Payment"),
    category: findColumnIndex(headers, "Category"),
  };

  for (const [key, idx] of Object.entries(colIndices)) {
    if (idx === -1) {
      errors.push(
        `Missing column: ${
          EXPECTED_COLUMNS.find(
            (c) => c.toLowerCase().replace(/ /g, "") === key.toLowerCase()
          ) ?? key
        }`
      );
    }
  }

  if (errors.length > 0) {
    return { rows: [], errors };
  }

  const rows: ExcelRow[] = [];

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i] as unknown[];
    if (
      !row ||
      row.every((cell) => cell === null || cell === undefined || cell === "")
    ) {
      continue;
    }

    const amount = parseNumber(row[colIndices.amount]);
    const quantity = parseNumber(row[colIndices.quantity]) || 1;
    const totalAmount =
      parseNumber(row[colIndices.totalAmount]) || amount * quantity;

    rows.push({
      date: parseDate(row[colIndices.date]),
      purchases: String(row[colIndices.purchases] ?? "").trim(),
      amount,
      quantity,
      totalAmount,
      paymentMode: String(row[colIndices.paymentMode] ?? "Other").trim(),
      category: String(row[colIndices.category] ?? "").trim(),
      type: "expense",
    });
  }

  return { rows, errors: [] };
}

export function parseSpreadsheetBuffer(
  buffer: Buffer,
  _filename?: string
): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return { rows: [], errors: ["No sheets found in workbook"] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  if (rawData.length < 1) {
    return { rows: [], errors: ["Spreadsheet is empty"] };
  }

  const headers = extractHeaders(rawData[0] as unknown[]);

  if (detectCostingFormat(headers)) {
    const { rows, errors, warnings } = parseCostingCsvBuffer(buffer);
    return {
      rows: rows.map((row) => ({
        date: row.date,
        purchases: row.purchases,
        amount: row.amount,
        quantity: row.quantity,
        totalAmount: row.totalAmount,
        paymentMode: row.paymentMode,
        category: row.category,
        type: row.type,
        warning: row.warning,
        rowNumber: row.rowNumber,
      })),
      errors,
      warnings,
    };
  }

  return parseStandardBuffer(buffer);
}

export function parseExcelBuffer(buffer: Buffer): ParseResult {
  return parseSpreadsheetBuffer(buffer);
}
