export const INGREDIENT_SECTIONS = ["drinks", "siomai", "rnd"] as const;
export type IngredientSection = (typeof INGREDIENT_SECTIONS)[number];

export const INGREDIENT_SECTION_LABELS: Record<IngredientSection, string> = {
  drinks: "Drinks",
  siomai: "Siomai",
  rnd: "Research & Development",
};

export function isIngredientSection(value: string): value is IngredientSection {
  return (INGREDIENT_SECTIONS as readonly string[]).includes(value);
}

/** Best-effort section from name when creating / backfilling. */
export function guessIngredientSection(name: string): IngredientSection {
  const n = name.toLowerCase();
  if (
    /\bsiomai\b/.test(n) ||
    /\bdumpling\b/.test(n) ||
    /\bwonton\b/.test(n) ||
    /\bchilli\s*oil\b/.test(n) ||
    /\bpork\s*shrimp\b/.test(n)
  ) {
    return "siomai";
  }
  if (
    /\br&d\b/.test(n) ||
    /\brnd\b/.test(n) ||
    /\bresearch\b/.test(n) ||
    /\bprototype\b/.test(n) ||
    /\btest\b/.test(n) ||
    /\btrial\b/.test(n)
  ) {
    return "rnd";
  }
  return "drinks";
}
