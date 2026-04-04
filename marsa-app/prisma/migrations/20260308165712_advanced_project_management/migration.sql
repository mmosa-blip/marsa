-- CreateEnum
CREATE TYPE "RequirementType" AS ENUM ('DOCUMENT', 'PAYMENT', 'SIGNATURE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('PENDING', 'COMPLETED', 'WAIVED');

-- CreateEnum
CREATE TYPE "MilestoneType" AS ENUM ('SERVICE', 'PAYMENT', 'APPROVAL');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('LOCKED', 'UNLOCKED', 'IN_PROGRESS', 'COMPLETED');

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'WAITING_EXTERNAL';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedById" TEXT,
ADD COLUMN     "closureNotes" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "externalEntity" TEXT;

-- CreateTable
CREATE TABLE "project_requirements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "RequirementType" NOT NULL DEFAULT 'CUSTOM',
    "status" "RequirementStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,
    "ownerId" TEXT,
    "documentId" TEXT,
    "invoiceId" TEXT,

    CONSTRAINT "project_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_milestones" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "MilestoneType" NOT NULL,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'LOCKED',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isParallel" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,
    "serviceId" TEXT,
    "invoiceId" TEXT,
    "dependsOnId" TEXT,

    CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_closure_delegations" (
    "id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "delegatedFromId" TEXT NOT NULL,
    "delegatedToId" TEXT NOT NULL,

    CONSTRAINT "project_closure_delegations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_requirements_documentId_key" ON "project_requirements"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "project_requirements_invoiceId_key" ON "project_requirements"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "project_milestones_serviceId_key" ON "project_milestones"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "project_milestones_invoiceId_key" ON "project_milestones"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "project_closure_delegations_projectId_delegatedFromId_deleg_key" ON "project_closure_delegations"("projectId", "delegatedFromId", "delegatedToId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_requirements" ADD CONSTRAINT "project_requirements_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_requirements" ADD CONSTRAINT "project_requirements_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_requirements" ADD CONSTRAINT "project_requirements_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_requirements" ADD CONSTRAINT "project_requirements_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "project_milestones"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "project_closure_delegations" ADD CONSTRAINT "project_closure_delegations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_closure_delegations" ADD CONSTRAINT "project_closure_delegations_delegatedFromId_fkey" FOREIGN KEY ("delegatedFromId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_closure_delegations" ADD CONSTRAINT "project_closure_delegations_delegatedToId_fkey" FOREIGN KEY ("delegatedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
