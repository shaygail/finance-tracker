-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "gstNumber" TEXT,
    "balanceDate" TEXT NOT NULL DEFAULT '03-31',
    "gstFilingFrequency" TEXT NOT NULL DEFAULT 'two_monthly',
    "financialYearStart" TEXT NOT NULL DEFAULT '04-01',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BusinessMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    CONSTRAINT "BusinessMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BusinessMember_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'expense',
    CONSTRAINT "Category_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "categoryId" TEXT,
    "ingredientId" TEXT,
    "date" DATETIME NOT NULL,
    "vendor" TEXT NOT NULL,
    "unitAmount" REAL NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 1,
    "totalAmount" REAL NOT NULL,
    "paymentMode" TEXT NOT NULL,
    "amountExGst" REAL NOT NULL,
    "gstAmount" REAL NOT NULL,
    "amountIncGst" REAL NOT NULL,
    "gstType" TEXT NOT NULL DEFAULT 'standard_15',
    "type" TEXT NOT NULL DEFAULT 'expense',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "parLevel" REAL NOT NULL DEFAULT 0,
    "currentStock" REAL NOT NULL DEFAULT 0,
    "qrCode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Ingredient_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockCount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ingredientId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "countedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "countedById" TEXT NOT NULL,
    CONSTRAINT "StockCount_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockCount_countedById_fkey" FOREIGN KEY ("countedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unitsSold" REAL NOT NULL DEFAULT 0,
    "revenue" REAL NOT NULL DEFAULT 0,
    "cogs" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "Product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL,
    "amount" REAL,
    "vendor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unmatched',
    "attachmentUrl" TEXT,
    CONSTRAINT "Invoice_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportBatch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavingsGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetAmount" REAL NOT NULL,
    "currentAmount" REAL NOT NULL DEFAULT 0,
    "deadline" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavingsGoal_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CategorisationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL DEFAULT 'vendor',
    CONSTRAINT "CategorisationRule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessMember_userId_businessId_key" ON "BusinessMember"("userId", "businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_businessId_slug_key" ON "Category"("businessId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_qrCode_key" ON "Ingredient"("qrCode");

-- CreateIndex
CREATE UNIQUE INDEX "Product_businessId_name_key" ON "Product"("businessId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_businessId_externalId_key" ON "Invoice"("businessId", "externalId");
