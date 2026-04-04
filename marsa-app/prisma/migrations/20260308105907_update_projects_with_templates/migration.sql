-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "description" TEXT,
ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "totalPrice" DOUBLE PRECISION,
ADD COLUMN     "workflowType" "WorkflowType" NOT NULL DEFAULT 'SEQUENTIAL';

-- CreateTable
CREATE TABLE "project_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "workflowType" "WorkflowType" NOT NULL DEFAULT 'SEQUENTIAL',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "project_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_template_services" (
    "id" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "projectTemplateId" TEXT NOT NULL,
    "serviceTemplateId" TEXT NOT NULL,

    CONSTRAINT "project_template_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_template_services_projectTemplateId_serviceTemplate_key" ON "project_template_services"("projectTemplateId", "serviceTemplateId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "project_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_templates" ADD CONSTRAINT "project_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_template_services" ADD CONSTRAINT "project_template_services_projectTemplateId_fkey" FOREIGN KEY ("projectTemplateId") REFERENCES "project_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_template_services" ADD CONSTRAINT "project_template_services_serviceTemplateId_fkey" FOREIGN KEY ("serviceTemplateId") REFERENCES "service_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
