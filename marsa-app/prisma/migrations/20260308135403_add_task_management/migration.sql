-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'TASK_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'TASK_TRANSFER_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'TASK_TRANSFER_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'TASK_TRANSFER_REJECTED';

-- CreateTable
CREATE TABLE "service_provider_mappings" (
    "id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serviceTemplateId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,

    CONSTRAINT "service_provider_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_rejections" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taskId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,

    CONSTRAINT "task_rejections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_transfer_requests" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "taskId" TEXT NOT NULL,
    "fromProviderId" TEXT NOT NULL,
    "toProviderId" TEXT NOT NULL,
    "reviewedById" TEXT,

    CONSTRAINT "task_transfer_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_transfer_delegations" (
    "id" TEXT NOT NULL,
    "isPermanent" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fromProviderId" TEXT NOT NULL,
    "toProviderId" TEXT NOT NULL,

    CONSTRAINT "task_transfer_delegations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_provider_mappings_serviceTemplateId_providerId_key" ON "service_provider_mappings"("serviceTemplateId", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "task_transfer_delegations_fromProviderId_toProviderId_key" ON "task_transfer_delegations"("fromProviderId", "toProviderId");

-- AddForeignKey
ALTER TABLE "service_provider_mappings" ADD CONSTRAINT "service_provider_mappings_serviceTemplateId_fkey" FOREIGN KEY ("serviceTemplateId") REFERENCES "service_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_provider_mappings" ADD CONSTRAINT "service_provider_mappings_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_rejections" ADD CONSTRAINT "task_rejections_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_rejections" ADD CONSTRAINT "task_rejections_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_transfer_requests" ADD CONSTRAINT "task_transfer_requests_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_transfer_requests" ADD CONSTRAINT "task_transfer_requests_fromProviderId_fkey" FOREIGN KEY ("fromProviderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_transfer_requests" ADD CONSTRAINT "task_transfer_requests_toProviderId_fkey" FOREIGN KEY ("toProviderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_transfer_requests" ADD CONSTRAINT "task_transfer_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_transfer_delegations" ADD CONSTRAINT "task_transfer_delegations_fromProviderId_fkey" FOREIGN KEY ("fromProviderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_transfer_delegations" ADD CONSTRAINT "task_transfer_delegations_toProviderId_fkey" FOREIGN KEY ("toProviderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
