/**
 * POS item `description` is stored on SaleLine.notes as "Key: Value · Key: Value".
 * Helpers for display (accountant-facing add-ons / options).
 */

/** Split stored notes into option parts. */
export function parseSaleLineOptions(notes: string | null | undefined): string[] {
  if (!notes?.trim()) return [];
  return notes
    .split(/\s*·\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Options worth showing to an accountant — drops "…: None" noise
 * but keeps size, milk, foam, syrup, extras, etc.
 */
export function meaningfulSaleOptions(notes: string | null | undefined): string[] {
  return parseSaleLineOptions(notes).filter((part) => !/:\s*None\s*$/i.test(part));
}

/** Base build options — not counted as paid / notable add-ons. */
const BASE_OPTION_KEYS = /^(size|temp|temperature|level|ice|sweetness)$/i;
const DEFAULT_MILK = /^(whole|none|regular)$/i;

/**
 * Notable drink add-ons from POS notes (alt milk, foam, syrup, extras).
 * Skips size/temp/ice defaults and "None" values.
 */
export function extractDrinkAddOns(notes: string | null | undefined): string[] {
  const out: string[] = [];
  for (const part of parseSaleLineOptions(notes)) {
    if (/:\s*None\s*$/i.test(part)) continue;
    const match = part.match(/^([^:]+):\s*(.+)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim();
    if (!value) continue;
    if (BASE_OPTION_KEYS.test(key)) continue;
    if (/^milk$/i.test(key) && DEFAULT_MILK.test(value)) continue;
    out.push(`${key}: ${value}`.replace(/\s+/g, " "));
  }
  return out;
}
