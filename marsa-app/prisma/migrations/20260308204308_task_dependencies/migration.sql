-- AlterTable
ALTER TABLE "task_templates" ADD COLUMN     "dependsOnId" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "dependsOnId" TEXT;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "task_templates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
