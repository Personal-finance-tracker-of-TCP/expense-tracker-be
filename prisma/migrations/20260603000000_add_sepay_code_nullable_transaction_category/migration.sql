ALTER TABLE "User" ADD COLUMN "sepayCode" TEXT;

CREATE UNIQUE INDEX "User_sepayCode_key" ON "User"("sepayCode");

ALTER TABLE "Transaction" ALTER COLUMN "categoryId" DROP NOT NULL;
