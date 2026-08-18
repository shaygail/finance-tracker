-- CreateTable
CREATE TABLE IF NOT EXISTS "BankStatement" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "accountNumber" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "openingBalance" DOUBLE PRECISION,
    "closingBalance" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BankStatementLine" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "lineIndex" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "txnType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "withdrawal" DOUBLE PRECISION,
    "deposit" DOUBLE PRECISION,
    "balance" DOUBLE PRECISION,
    "fingerprint" TEXT NOT NULL,
    "suggestedAction" TEXT NOT NULL,
    "suggestedCategoryId" TEXT,
    "matchedTransactionId" TEXT,
    "matchNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "appliedTransactionId" TEXT,

    CONSTRAINT "BankStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BankStatement_businessId_createdAt_idx" ON "BankStatement"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BankStatementLine_statementId_lineIndex_key" ON "BankStatementLine"("statementId", "lineIndex");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BankStatementLine_fingerprint_idx" ON "BankStatementLine"("fingerprint");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "BankStatement" ADD CONSTRAINT "BankStatement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "BankStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
