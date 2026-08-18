-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN IF NOT EXISTS "section" TEXT NOT NULL DEFAULT 'drinks';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Ingredient_businessId_section_idx" ON "Ingredient"("businessId", "section");

-- Heuristic backfill for siomai-related names
UPDATE "Ingredient"
SET "section" = 'siomai'
WHERE lower("name") LIKE '%siomai%'
   OR lower("name") LIKE '%dumpling%'
   OR lower("name") LIKE '%wonton%'
   OR lower("name") LIKE '%chilli oil%';
