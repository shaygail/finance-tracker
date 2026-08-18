/**
 * Map POS / web item name variants onto a single product name.
 * Keys must be lowercase trimmed.
 */
const PRODUCT_NAME_ALIASES: Record<string, string> = {
  "twilight cloud": "Twilight Coconut Cloud",
  "twilight coco cloud": "Twilight Coconut Cloud",
  "twilight coconut cloud": "Twilight Coconut Cloud",
  "black pearl cloud": "Black Pearl Coconut Cloud",
  "clover cloud": "Clover Coconut Cloud",
  "ube cream cold brew": "Ube Cream Coldbrew Latte",
  "ube cream coldbrew": "Ube Cream Coldbrew Latte",
  "bp cb": "Black Pearl Cold Brew",
  "ube cb": "Ube Cream Cold Brew",
};

export function canonicalizeProductName(name: string): string {
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");
  return PRODUCT_NAME_ALIASES[key] ?? name.trim();
}
