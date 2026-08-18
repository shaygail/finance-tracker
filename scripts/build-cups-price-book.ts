/**
 * Build drink unit-price → size book from sales CSVs, then write
 * src/lib/cups-price-book.json for runtime lookups.
 *
 * Sources:
 * - detailed sheet (has Size + Unit Price) — primary
 * - early sheet (Items + Subtotal) — fills Regular at $8 / $8.50 and Strawberry Matcha $10
 */
import fs from "fs";
import path from "path";

function parseRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (c === "," && !q) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function normName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function money(n: number): string {
  return String(Math.round(n * 100) / 100);
}

type Size = "regular" | "large";
type Book = Record<string, Record<string, Size>>;

const earlyPath = path.join(process.cwd(), "data/early-sales-prices.csv");
const detailedPath = path.join(process.cwd(), "data/detailed-sales-with-size.csv");
const outPath = path.join(process.cwd(), "src/lib/cups-price-book.json");

const book: Book = {};

function set(name: string, price: string, size: Size) {
  const key = normName(name);
  if (!key) return;
  book[key] ??= {};
  // Prefer existing detailed-sheet mapping if already set
  if (!book[key][price]) book[key][price] = size;
}

// --- detailed sheet (authoritative when Size present) ---
{
  const lines = fs.readFileSync(detailedPath, "utf8").split(/\r?\n/);
  const header = parseRow(lines[0]);
  const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
  const votes: Record<string, Record<string, { regular: number; large: number }>> = {};

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const r = parseRow(line);
    const item = (r[idx["Item"]] || "").trim();
    const sizeRaw = (r[idx["Size"]] || "").trim();
    const price = Number(r[idx["Unit Price (NZD)"]]);
    const qty = Number(r[idx["Quantity"]]) || 0;
    if (!item || !sizeRaw || !Number.isFinite(price) || qty <= 0) continue;
    if (/total/i.test(item)) continue;
    if (!/^(regular|large|venti|grande)$/i.test(sizeRaw)) continue;
    const size: Size = /large|venti/i.test(sizeRaw) ? "large" : "regular";
    const key = normName(item);
    const p = money(price);
    votes[key] ??= {};
    votes[key][p] ??= { regular: 0, large: 0 };
    votes[key][p][size] += qty;
  }

  for (const [name, prices] of Object.entries(votes)) {
    for (const [p, counts] of Object.entries(prices)) {
      book[name] ??= {};
      book[name][p] = counts.regular >= counts.large ? "regular" : "large";
    }
  }
}

// --- early sheet heuristics (only fill gaps) ---
{
  const lines = fs.readFileSync(earlyPath, "utf8").split(/\r?\n/);
  const header = parseRow(lines[0]);
  const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const r = parseRow(line);
    const items = (r[idx["Items"]] || "").trim();
    const qty = Number(r[idx["Quantity"]]) || 0;
    const sub = Number(r[idx["Subtotal (NZD)"]]) || 0;
    if (!items || !qty || !sub) continue;
    // Skip combo tickets
    if (items.includes(",") || /\d+x\s/i.test(items) || /\band\b/i.test(items)) continue;

    const unit = Math.round((sub / qty) * 100) / 100;
    const p = money(unit);
    const strawberry = /\bstrawberry\s*matcha\b/i.test(items);

    if (strawberry && (unit === 10 || unit === 10.0)) {
      set(items, p, "regular");
      continue;
    }
    if (!strawberry && (unit === 8 || unit === 8.5)) {
      set(items, p, "regular");
      continue;
    }
  }

  // For early singles with two clear price tiers, lower=regular higher=large
  const tiers: Record<string, Set<number>> = {};
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const r = parseRow(line);
    const items = (r[idx["Items"]] || "").trim();
    const qty = Number(r[idx["Quantity"]]) || 0;
    const sub = Number(r[idx["Subtotal (NZD)"]]) || 0;
    if (!items || qty !== 1 || !sub) continue; // unit price only trustworthy at qty 1
    if (items.includes(",") || /\d+x\s/i.test(items) || /\band\b/i.test(items)) continue;
    const unit = Math.round((sub / qty) * 100) / 100;
    if (unit < 6 || unit > 20) continue;
    const key = normName(items);
    tiers[key] ??= new Set();
    tiers[key].add(unit);
  }
  for (const [key, prices] of Object.entries(tiers)) {
    const sorted = [...prices].sort((a, b) => a - b);
    if (sorted.length < 2) continue;
    const low = sorted[0];
    const high = sorted[sorted.length - 1];
    const gap = high - low;
    if (gap < 1.5 || gap > 5) continue;
    book[key] ??= {};
    if (!book[key][money(low)]) book[key][money(low)] = "regular";
    if (!book[key][money(high)]) book[key][money(high)] = "large";
  }
}

// Global fallbacks used when product-specific entry missing
const meta = {
  generatedAt: new Date().toISOString(),
  sources: ["data/early-sales-prices.csv", "data/detailed-sales-with-size.csv"],
  globalRegularPrices: [8, 8.5],
  strawberryMatchaRegularPrices: [10],
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(
  outPath,
  JSON.stringify({ meta, book }, null, 2) + "\n",
  "utf8"
);

console.log(
  `Wrote ${Object.keys(book).length} products to ${outPath}`
);
