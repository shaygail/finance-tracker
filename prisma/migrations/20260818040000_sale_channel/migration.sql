-- AlterTable
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'stall';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Sale_businessId_channel_idx" ON "Sale"("businessId", "channel");
