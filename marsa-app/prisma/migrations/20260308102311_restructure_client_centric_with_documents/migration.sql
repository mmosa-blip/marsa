-- CreateEnum
CREATE TYPE "AuthorizationType" AS ENUM ('FULL', 'PER_SERVICE', 'NONE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('COMMERCIAL_REGISTER', 'MUNICIPAL_LICENSE', 'ZAKAT_CERTIFICATE', 'INSURANCE_CERTIFICATE', 'CHAMBER_CERTIFICATE', 'LEASE_CONTRACT', 'CIVIL_DEFENSE', 'SAUDIZATION', 'GOSI_CERTIFICATE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('VALID', 'EXPIRING_SOON', 'EXPIRED', 'PENDING_RENEWAL');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "authorizationGrantedAt" TIMESTAMP(3),
ADD COLUMN     "authorizationType" "AuthorizationType" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL DEFAULT 'CUSTOM',
    "customTypeName" TEXT,
    "documentNumber" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "status" "DocumentStatus" NOT NULL DEFAULT 'VALID',
    "fileUrl" TEXT,
    "notes" TEXT,
    "reminderDays" INTEGER NOT NULL DEFAULT 30,
    "isLinkedToCompany" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,
    "companyId" TEXT,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
