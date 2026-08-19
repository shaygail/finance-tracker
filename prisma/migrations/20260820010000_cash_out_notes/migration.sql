-- CreateTable
CREATE TABLE "CashOutNote" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "label" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashOutNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashOutNote_businessId_date_idx" ON "CashOutNote"("businessId", "date");

-- AddForeignKey
ALTER TABLE "CashOutNote" ADD CONSTRAINT "CashOutNote_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
