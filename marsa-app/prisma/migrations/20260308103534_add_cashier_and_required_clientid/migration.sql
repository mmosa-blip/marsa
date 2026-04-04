/*
  Warnings:

  - Made the column `clientId` on table `services` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "CashierPaymentMethod" AS ENUM ('CASH', 'MADA', 'BANK_TRANSFER', 'DEFERRED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('COMPLETED', 'DEFERRED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "services" DROP CONSTRAINT "services_clientId_fkey";

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "projectId" TEXT,
ALTER COLUMN "clientId" SET NOT NULL;

-- CreateTable
CREATE TABLE "cashier_transactions" (
    "id" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "taxAmount" DOUBLE PRECISION NOT NULL,
    "grandTotal" DOUBLE PRECISION NOT NULL,
    "paymentMethod" "CashierPaymentMethod" NOT NULL,
    "amountReceived" DOUBLE PRECISION,
    "changeAmount" DOUBLE PRECISION,
    "referenceNumber" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,

    CONSTRAINT "cashier_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cashier_transactions_transactionNumber_key" ON "cashier_transactions"("transactionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "cashier_transactions_invoiceId_key" ON "cashier_transactions"("invoiceId");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_transactions" ADD CONSTRAINT "cashier_transactions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_transactions" ADD CONSTRAINT "cashier_transactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashier_transactions" ADD CONSTRAINT "cashier_transactions_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
