CREATE TYPE "TransactionClassificationStatus" AS ENUM ('UNCLASSIFIED', 'CLASSIFIED', 'EXCLUDED');

ALTER TABLE "Transaction"
ADD COLUMN "classificationStatus" "TransactionClassificationStatus" NOT NULL DEFAULT 'UNCLASSIFIED';

UPDATE "Transaction"
SET "classificationStatus" = 'CLASSIFIED'
WHERE "categoryId" IS NOT NULL OR "source" = 'MANUAL';

UPDATE "Transaction"
SET "classificationStatus" = 'UNCLASSIFIED'
WHERE "source" = 'SEPAY' AND "categoryId" IS NULL;

CREATE INDEX "Transaction_classificationStatus_idx" ON "Transaction"("classificationStatus");
