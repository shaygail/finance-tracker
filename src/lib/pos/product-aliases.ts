/**
 * Map POS / web item name variants onto a single product name.
 * Keys must be lowercase trimmed.
 */
const PRODUCT_NAME_ALIASES: Record<string, string> = {
  "twilight cloud": "Twilight Coconut Cloud",
  "twilight coco cloud": "Twilight Coconut Cloud",
  "twilight coconut cloud": "Twilight Coconut Cloud",
};

export function canonicalizeProductName(name: string): string {
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");
  return PRODUCT_NAME_ALIASES[key] ?? name.trim();
}
