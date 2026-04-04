-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('PENDING_SUPERVISOR', 'PENDING_FINANCE', 'PENDING_TREASURY', 'APPROVED', 'PAID', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'EXTERNAL_PROVIDER';
ALTER TYPE "Role" ADD VALUE 'FINANCE_MANAGER';
ALTER TYPE "Role" ADD VALUE 'TREASURY_MANAGER';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bankIban" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "costPerTask" DOUBLE PRECISION,
ADD COLUMN     "isExternal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "specialization" TEXT,
ADD COLUMN     "supervisorId" TEXT;

-- CreateTable
CREATE TABLE "task_costs" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taskId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,

    CONSTRAINT "task_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_requests" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING_SUPERVISOR',
    "notes" TEXT,
    "supervisorApproval" BOOLEAN,
    "supervisorApprovedAt" TIMESTAMP(3),
    "supervisorNotes" TEXT,
    "financeApproval" BOOLEAN,
    "financeApprovedAt" TIMESTAMP(3),
    "financeNotes" TEXT,
    "treasuryApproval" BOOLEAN,
    "treasuryApprovedAt" TIMESTAMP(3),
    "treasuryNotes" TEXT,
    "paymentMethod" "PaymentMethod",
    "paymentReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "taskCostId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,

    CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_costs_taskId_providerId_key" ON "task_costs"("taskId", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_requests_requestNumber_key" ON "payment_requests"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payment_requests_taskCostId_key" ON "payment_requests"("taskCostId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_costs" ADD CONSTRAINT "task_costs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_costs" ADD CONSTRAINT "task_costs_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_taskCostId_fkey" FOREIGN KEY ("taskCostId") REFERENCES "task_costs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
