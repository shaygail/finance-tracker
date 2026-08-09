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

function utcDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return probe;
}

type DateCandidates =
  | { kind: "definite"; date: Date }
  | { kind: "ambiguous"; dmy: Date; mdy: Date }
  | { kind: "invalid" };

/** Resolve slash dates; ambiguous a/b/yyyy returns both NZ (D/M) and US (M/D) options. */
export function purchaseDateCandidates(value: unknown): DateCandidates {
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return { kind: "invalid" };
    const d = utcDate(date.y, date.m, date.d);
    return d ? { kind: "definite", date: d } : { kind: "invalid" };
  }

  let trimmed = "";
  if (typeof value === "string") trimmed = value.trim();
  else if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const d = utcDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
    return d ? { kind: "definite", date: d } : { kind: "invalid" };
  } else if (value != null) trimmed = String(value).trim();

  if (!trimmed) return { kind: "invalid" };

  const m = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) {
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return { kind: "invalid" };
    const u = utcDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return u ? { kind: "definite", date: u } : { kind: "invalid" };
  }

  const a = parseInt(m[1], 10);
  const b = parseInt(m[2], 10);
  let year = parseInt(m[3], 10);
  if (year < 100) year += 2000;

  if (b > 12) {
    const d = utcDate(year, a, b); // M/D/Y
    return d ? { kind: "definite", date: d } : { kind: "invalid" };
  }
  if (a > 12) {
    const d = utcDate(year, b, a); // D/M/Y
    return d ? { kind: "definite", date: d } : { kind: "invalid" };
  }

  const dmy = utcDate(year, b, a);
  const mdy = utcDate(year, a, b);
  if (dmy && mdy) {
    if (dmy.getTime() === mdy.getTime()) return { kind: "definite", date: dmy };
    return { kind: "ambiguous", dmy, mdy };
  }
  if (dmy) return { kind: "definite", date: dmy };
  if (mdy) return { kind: "definite", date: mdy };
  return { kind: "invalid" };
}

/** Prefer NZ D/M/Y; if second part > 12 treat as M/D/Y (e.g. 3/28/2026). */
export function parsePurchaseDate(value: unknown): Date | null {
  const c = purchaseDateCandidates(value);
  if (c.kind === "definite") return c.date;
  if (c.kind === "ambiguous") return c.dmy; // NZ default when no neighbours
  return null;
}

function pickAmbiguousDate(
  dmy: Date,
  mdy: Date,
  anchors: Date[]
): Date {
  if (anchors.length === 0) return dmy;
  const score = (d: Date) =>
    Math.min(...anchors.map((a) => Math.abs(d.getTime() - a.getTime())));
  return score(mdy) < score(dmy) ? mdy : dmy;
}

export function normalizeAssetKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
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
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  // raw:true keeps CSV date strings (e.g. 5/3/2026) instead of US Excel serials
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
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

  type Draft = {
    rowNumber: number;
    name: string;
    description: string | null;
    location: string | null;
    model: string | null;
    brand: string | null;
    quantity: number;
    unitCost: number;
    totalCost: number;
    dateCandidates: DateCandidates;
  };

  const drafts: Draft[] = [];

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

    if (/^total/i.test(name) || (parseNumber(name) > 0 && !description && !model)) {
      skipped += 1;
      continue;
    }

    const unitCost = parseNumber(row[cols.cost]);
    const quantity = cols.quantity >= 0 ? parseNumber(row[cols.quantity]) || 1 : 1;
    if (unitCost <= 0) {
      skipped += 1;
      continue;
    }

    const dateCandidates = purchaseDateCandidates(row[cols.date]);
    if (dateCandidates.kind === "invalid") {
      errors.push(`Row ${i + 1}: missing or invalid Date of Purchase for “${name}”`);
      skipped += 1;
      continue;
    }

    drafts.push({
      rowNumber: i + 1,
      name,
      description: description || null,
      location: cols.location >= 0 ? cell(row, cols.location) || null : null,
      model: model || null,
      brand: cols.brand >= 0 ? cell(row, cols.brand) || null : null,
      quantity,
      unitCost,
      totalCost: Math.round(unitCost * quantity * 100) / 100,
      dateCandidates,
    });
  }

  // Definite dates act as anchors so ambiguous 5/2/2026 → May 2 near April rows,
  // while 5/3/2026 → 5 March near February/March NZ-style rows.
  const resolvedDates: Array<Date | null> = drafts.map((d) =>
    d.dateCandidates.kind === "definite" ? d.dateCandidates.date : null
  );

  // Forward pass
  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i];
    if (draft.dateCandidates.kind === "definite") {
      resolvedDates[i] = draft.dateCandidates.date;
      continue;
    }
    if (draft.dateCandidates.kind !== "ambiguous") {
      resolvedDates[i] = null;
      continue;
    }
    const anchors: Date[] = [];
    for (let j = Math.max(0, i - 5); j <= Math.min(drafts.length - 1, i + 5); j++) {
      if (j === i) continue;
      const a = resolvedDates[j];
      if (a) anchors.push(a);
    }
    resolvedDates[i] = pickAmbiguousDate(
      draft.dateCandidates.dmy,
      draft.dateCandidates.mdy,
      anchors
    );
  }

  // Backward pass with peer resolutions
  for (let i = drafts.length - 1; i >= 0; i--) {
    const draft = drafts[i];
    if (draft.dateCandidates.kind !== "ambiguous") continue;
    const anchors: Date[] = [];
    for (let j = Math.max(0, i - 5); j <= Math.min(drafts.length - 1, i + 5); j++) {
      if (j === i) continue;
      const a = resolvedDates[j];
      if (a) anchors.push(a);
    }
    resolvedDates[i] = pickAmbiguousDate(
      draft.dateCandidates.dmy,
      draft.dateCandidates.mdy,
      anchors
    );
  }

  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i];
    const datePurchased = resolvedDates[i]!;
    rows.push({
      name: draft.name,
      description: draft.description,
      location: draft.location,
      model: draft.model,
      brand: draft.brand,
      quantity: draft.quantity,
      datePurchased,
      unitCost: draft.unitCost,
      totalCost: draft.totalCost,
      rowNumber: draft.rowNumber,
    });
  }

  return { rows, errors, skipped };
}
