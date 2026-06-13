-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "TxType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TxSource" AS ENUM ('MANUAL', 'SEPAY');

-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('INCOME', 'EXPENSE', 'BOTH');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('MONTHLY', 'TOTAL');

-- CreateEnum
CREATE TYPE "TransferType" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "SepayLogStatus" AS ENUM ('PENDING', 'PROCESSED', 'DUPLICATE', 'UNMATCHED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('PDF', 'EXCEL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sepayCode" VARCHAR(32),
    "bankAccountNumber" VARCHAR(64),
    "refreshToken" TEXT,
    "avatarUrl" TEXT,
    "provider" TEXT DEFAULT 'local',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT,
    "type" "TxType" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "note" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "TxSource" NOT NULL DEFAULT 'MANUAL',
    "sepayId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "type" "CategoryType" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "limitAmount" DECIMAL(15,2) NOT NULL,
    "period" "PeriodType" NOT NULL,
    "month" INTEGER,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SepayLog" (
    "id" TEXT NOT NULL,
    "sepayId" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "transferAmount" DECIMAL(15,2) NOT NULL,
    "transferType" "TransferType" NOT NULL,
    "content" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "matchedCode" VARCHAR(32),
    "status" "SepayLogStatus" NOT NULL DEFAULT 'PENDING',
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "errorReason" TEXT,
    "transactionId" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SepayLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAdviceLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "inputHash" TEXT,
    "inputSummary" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "provider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAdviceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportExportLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "month" INTEGER,
    "year" INTEGER,
    "fromDate" TIMESTAMP(3),
    "toDate" TIMESTAMP(3),
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportExportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_sepayCode_key" ON "User"("sepayCode");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_sepayCode_idx" ON "User"("sepayCode");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_sepayId_key" ON "Transaction"("sepayId");

-- CreateIndex
CREATE INDEX "Transaction_userId_transactionDate_idx" ON "Transaction"("userId", "transactionDate");

-- CreateIndex
CREATE INDEX "Transaction_userId_source_idx" ON "Transaction"("userId", "source");

-- CreateIndex
CREATE INDEX "Transaction_categoryId_idx" ON "Transaction"("categoryId");

-- CreateIndex
CREATE INDEX "Transaction_sepayId_idx" ON "Transaction"("sepayId");

-- CreateIndex
CREATE INDEX "Category_userId_idx" ON "Category"("userId");

-- CreateIndex
CREATE INDEX "Category_type_idx" ON "Category"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_name_type_key" ON "Category"("userId", "name", "type");

-- CreateIndex
CREATE INDEX "Budget_userId_idx" ON "Budget"("userId");

-- CreateIndex
CREATE INDEX "Budget_categoryId_idx" ON "Budget"("categoryId");

-- CreateIndex
CREATE INDEX "Budget_period_month_year_idx" ON "Budget"("period", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_userId_categoryId_period_month_year_key" ON "Budget"("userId", "categoryId", "period", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "SepayLog_sepayId_key" ON "SepayLog"("sepayId");

-- CreateIndex
CREATE UNIQUE INDEX "SepayLog_transactionId_key" ON "SepayLog"("transactionId");

-- CreateIndex
CREATE INDEX "SepayLog_transactionDate_idx" ON "SepayLog"("transactionDate");

-- CreateIndex
CREATE INDEX "SepayLog_status_idx" ON "SepayLog"("status");

-- CreateIndex
CREATE INDEX "SepayLog_matchedCode_idx" ON "SepayLog"("matchedCode");

-- CreateIndex
CREATE INDEX "AiAdviceLog_userId_idx" ON "AiAdviceLog"("userId");

-- CreateIndex
CREATE INDEX "AiAdviceLog_period_idx" ON "AiAdviceLog"("period");

-- CreateIndex
CREATE INDEX "AiAdviceLog_createdAt_idx" ON "AiAdviceLog"("createdAt");

-- CreateIndex
CREATE INDEX "ReportExportLog_userId_idx" ON "ReportExportLog"("userId");

-- CreateIndex
CREATE INDEX "ReportExportLog_format_idx" ON "ReportExportLog"("format");

-- CreateIndex
CREATE INDEX "ReportExportLog_createdAt_idx" ON "ReportExportLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SepayLog" ADD CONSTRAINT "SepayLog_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAdviceLog" ADD CONSTRAINT "AiAdviceLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportExportLog" ADD CONSTRAINT "ReportExportLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
