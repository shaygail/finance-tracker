-- AlterTable
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "gstRegistered" BOOLEAN NOT NULL DEFAULT false;
