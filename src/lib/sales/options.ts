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
