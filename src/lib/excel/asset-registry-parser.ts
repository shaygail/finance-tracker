import * as XLSX from "xlsx";

export interface AssetRegistryRow {
  name: string;
  description: string | null;
  location: string | null;
  model: string | null;
  brand: string | null;
  quantity: number;
  datePurchased: Date;
  unitCost: number;
  totalCost: number;
  rowNumber: number;
}

export interface AssetParseResult {
  rows: AssetRegistryRow[];
  errors: string[];
  skipped: number;
}

function cell(row: unknown[], i: number): string {
  const v = row[i];
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function parseNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;
  const cleaned = value.replace(/[$,\s]/g, "").trim();
  if (!cleaned) return 0;
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

/** Prefer NZ D/M/Y; if second part > 12 treat as M/D/Y (e.g. 3/28/2026). */
export function parsePurchaseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) return new Date(date.y, date.m - 1, date.d);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const m = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime())
      ? null
      : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  const a = parseInt(m[1], 10);
  const b = parseInt(m[2], 10);
  let year = parseInt(m[3], 10);
  if (year < 100) year += 2000;

  let day: number;
  let month: number;
  if (b > 12) {
    // M/D/Y e.g. 3/28/2026
    month = a;
    day = b;
  } else if (a > 12) {
    // D/M/Y e.g. 21/02/2026
    day = a;
    month = b;
  } else {
    // Ambiguous — NZ default D/M/Y
    day = a;
    month = b;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }
  return d;
}

export function normalizeAssetKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function moneyClose(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.02;
}

function findHeaderRow(raw: unknown[][]): number {
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const row = (raw[i] ?? []).map((c) => String(c ?? "").trim().toLowerCase());
    if (row.includes("name") && row.some((c) => c.includes("date") && c.includes("purchase"))) {
      return i;
    }
    if (row.includes("name") && row.some((c) => c.includes("cost"))) {
      return i;
    }
  }
  return -1;
}

function colIndex(headers: string[], ...candidates: string[]): number {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const candidate of candidates) {
    const i = normalized.findIndex((h) => h === candidate || h.includes(candidate));
    if (i >= 0) return i;
  }
  return -1;
}

export function parseAssetRegistryBuffer(buffer: Buffer): AssetParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  const errors: string[] = [];
  const rows: AssetRegistryRow[] = [];
  let skipped = 0;

  const headerIdx = findHeaderRow(raw);
  if (headerIdx < 0) {
    return {
      rows: [],
      errors: [
        "Could not find Asset Registry headers (Name, Date of Purchase, Cost per Unit)",
      ],
      skipped: 0,
    };
  }

  const headers = (raw[headerIdx] as unknown[]).map((h) => String(h ?? "").trim());
  const cols = {
    name: colIndex(headers, "name"),
    description: colIndex(headers, "description"),
    location: colIndex(headers, "location"),
    model: colIndex(headers, "model"),
    brand: colIndex(headers, "brand"),
    quantity: colIndex(headers, "quantity"),
    date: colIndex(headers, "date of purchase", "date purchased", "purchase date", "date"),
    cost: colIndex(headers, "cost per unit", "unit cost", "cost"),
  };

  if (cols.name < 0 || cols.date < 0 || cols.cost < 0) {
    return {
      rows: [],
      errors: ["CSV must include Name, Date of Purchase, and Cost per Unit columns"],
      skipped: 0,
    };
  }

  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i] as unknown[];
    if (!row || row.every((c) => c === null || c === undefined || String(c).trim() === "")) {
      skipped += 1;
      continue;
    }

    let name = cell(row, cols.name);
    const description = cols.description >= 0 ? cell(row, cols.description) : "";
    const model = cols.model >= 0 ? cell(row, cols.model) : "";
    if (!name) name = description || model;
    if (!name) {
      skipped += 1;
      continue;
    }

    // Skip total / summary rows
    if (/^total/i.test(name) || parseNumber(name) > 0 && !description && !model) {
      skipped += 1;
      continue;
    }

    const datePurchased = parsePurchaseDate(row[cols.date]);
    const unitCost = parseNumber(row[cols.cost]);
    const quantity = cols.quantity >= 0 ? parseNumber(row[cols.quantity]) || 1 : 1;

    if (!datePurchased) {
      errors.push(`Row ${i + 1}: missing or invalid Date of Purchase for “${name}”`);
      skipped += 1;
      continue;
    }
    if (unitCost <= 0) {
      // Allow free items? Skip zero-cost empty totals
      skipped += 1;
      continue;
    }

    rows.push({
      name,
      description: description || null,
      location: cols.location >= 0 ? cell(row, cols.location) || null : null,
      model: model || null,
      brand: cols.brand >= 0 ? cell(row, cols.brand) || null : null,
      quantity,
      datePurchased,
      unitCost,
      totalCost: Math.round(unitCost * quantity * 100) / 100,
      rowNumber: i + 1,
    });
  }

  return { rows, errors, skipped };
}
