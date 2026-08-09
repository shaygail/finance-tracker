-- CreateTable
CREATE TABLE IF NOT EXISTS "Asset" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "model" TEXT,
    "brand" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "datePurchased" TIMESTAMP(3) NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "transactionId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'csv',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Asset_businessId_datePurchased_idx" ON "Asset"("businessId", "datePurchased");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Asset_businessId_name_idx" ON "Asset"("businessId", "name");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Asset" ADD CONSTRAINT "Asset_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Asset" ADD CONSTRAINT "Asset_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
