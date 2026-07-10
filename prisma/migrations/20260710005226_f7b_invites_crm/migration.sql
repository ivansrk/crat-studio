-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RegistrationStatus" ADD VALUE 'PENDING_OPT_IN';
ALTER TYPE "RegistrationStatus" ADD VALUE 'CONFIRMED';

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "inviteLinkId" TEXT,
ADD COLUMN     "wantsNewsletter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsapp" TEXT;

-- CreateTable
CREATE TABLE "InviteLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "courseSlug" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "maxRegistrations" INTEGER,
    "registrationsCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "topic" TEXT,
    "message" TEXT NOT NULL,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'NEW',
    "userId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'cabinet',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InviteLink_token_key" ON "InviteLink"("token");

-- CreateIndex
CREATE INDEX "InviteLink_token_idx" ON "InviteLink"("token");

-- CreateIndex
CREATE INDEX "ConsultationRequest_status_createdAt_idx" ON "ConsultationRequest"("status", "createdAt");
