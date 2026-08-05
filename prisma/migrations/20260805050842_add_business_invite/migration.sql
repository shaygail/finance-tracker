-- CreateTable
CREATE TABLE "BusinessInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'accountant',
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessInvite_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessInvite_token_key" ON "BusinessInvite"("token");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessInvite_businessId_email_key" ON "BusinessInvite"("businessId", "email");
