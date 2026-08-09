-- DropTable
DROP TABLE IF EXISTS "GmailConnection";

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "gmailEmail";
