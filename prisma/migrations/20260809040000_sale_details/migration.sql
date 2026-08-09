-- AlterTable
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "customerName" TEXT;

-- AlterTable
ALTER TABLE "SaleLine" ADD COLUMN IF NOT EXISTS "notes" TEXT;
