-- CreateTable
CREATE TABLE IF NOT EXISTS "TempLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "temperatureC" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TempLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ThermometerCalibration" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "calibratedAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "readingC" DOUBLE PRECISION NOT NULL,
    "passed" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ThermometerCalibration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CleaningChecklist" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "cleanedAt" TIMESTAMP(3) NOT NULL,
    "benches" BOOLEAN NOT NULL DEFAULT false,
    "milkJugs" BOOLEAN NOT NULL DEFAULT false,
    "steamWands" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CleaningChecklist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SupplierReceipt" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "supplier" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "amount" DOUBLE PRECISION,
    "fileName" TEXT,
    "fileMime" TEXT,
    "fileData" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TrainingSignOff" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "personRole" TEXT NOT NULL DEFAULT 'owner',
    "signedAt" TIMESTAMP(3) NOT NULL,
    "acknowledgedFcp" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingSignOff_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AllergenItem" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "containsGluten" BOOLEAN NOT NULL DEFAULT false,
    "containsDairy" BOOLEAN NOT NULL DEFAULT false,
    "containsSoy" BOOLEAN NOT NULL DEFAULT false,
    "containsEgg" BOOLEAN NOT NULL DEFAULT false,
    "containsPeanut" BOOLEAN NOT NULL DEFAULT false,
    "containsTreeNut" BOOLEAN NOT NULL DEFAULT false,
    "containsFish" BOOLEAN NOT NULL DEFAULT false,
    "containsShellfish" BOOLEAN NOT NULL DEFAULT false,
    "containsSesame" BOOLEAN NOT NULL DEFAULT false,
    "containsSulphites" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AllergenItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TempLog_businessId_kind_loggedAt_idx" ON "TempLog"("businessId", "kind", "loggedAt");
CREATE INDEX IF NOT EXISTS "ThermometerCalibration_businessId_calibratedAt_idx" ON "ThermometerCalibration"("businessId", "calibratedAt");
CREATE INDEX IF NOT EXISTS "CleaningChecklist_businessId_cleanedAt_idx" ON "CleaningChecklist"("businessId", "cleanedAt");
CREATE INDEX IF NOT EXISTS "SupplierReceipt_businessId_purchasedAt_idx" ON "SupplierReceipt"("businessId", "purchasedAt");
CREATE INDEX IF NOT EXISTS "TrainingSignOff_businessId_signedAt_idx" ON "TrainingSignOff"("businessId", "signedAt");
CREATE INDEX IF NOT EXISTS "AllergenItem_businessId_productName_idx" ON "AllergenItem"("businessId", "productName");

DO $$ BEGIN
  ALTER TABLE "TempLog" ADD CONSTRAINT "TempLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ThermometerCalibration" ADD CONSTRAINT "ThermometerCalibration_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CleaningChecklist" ADD CONSTRAINT "CleaningChecklist_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SupplierReceipt" ADD CONSTRAINT "SupplierReceipt_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TrainingSignOff" ADD CONSTRAINT "TrainingSignOff_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AllergenItem" ADD CONSTRAINT "AllergenItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
