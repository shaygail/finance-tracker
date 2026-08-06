-- AlterTable
ALTER TABLE "Business" ADD COLUMN "posLastSyncedAt" DATETIME;

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "posSaleId" TEXT NOT NULL,
    "soldAt" DATETIME NOT NULL,
    "totalAmount" REAL NOT NULL,
    "paymentMode" TEXT NOT NULL DEFAULT 'Other',
    "amountExGst" REAL NOT NULL,
    "gstAmount" REAL NOT NULL,
    "amountIncGst" REAL NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'pos',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sale_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SaleLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "productId" TEXT,
    "posProductId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "lineTotal" REAL NOT NULL,
    CONSTRAINT "SaleLine_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SaleLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PosSyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productsSync" INTEGER NOT NULL DEFAULT 0,
    "salesSync" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'success',
    "message" TEXT,
    CONSTRAINT "PosSyncLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "posProductId" TEXT,
    "unitPrice" REAL NOT NULL DEFAULT 0,
    "unitsSold" REAL NOT NULL DEFAULT 0,
    "revenue" REAL NOT NULL DEFAULT 0,
    "cogs" REAL NOT NULL DEFAULT 0,
    "lastSyncedAt" DATETIME,
    CONSTRAINT "Product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("businessId", "cogs", "id", "name", "revenue", "sku", "unitsSold") SELECT "businessId", "cogs", "id", "name", "revenue", "sku", "unitsSold" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_businessId_name_key" ON "Product"("businessId", "name");
CREATE UNIQUE INDEX "Product_businessId_posProductId_key" ON "Product"("businessId", "posProductId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Sale_businessId_posSaleId_key" ON "Sale"("businessId", "posSaleId");
