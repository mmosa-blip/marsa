-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "reminders" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "status" TEXT DEFAULT 'PENDING';

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
