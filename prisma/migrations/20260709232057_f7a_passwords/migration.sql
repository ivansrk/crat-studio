-- CreateEnum
CREATE TYPE "ResetTokenPurpose" AS ENUM ('PASSWORD_RESET', 'OPT_IN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EmailType" ADD VALUE 'WELCOME';
ALTER TYPE "EmailType" ADD VALUE 'PASSWORD_RESET';
ALTER TYPE "EmailType" ADD VALUE 'DOUBLE_OPT_IN';
ALTER TYPE "EmailType" ADD VALUE 'CONSULTATION';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "resendContactId" TEXT,
ADD COLUMN     "whatsapp" TEXT;

-- DropTable
DROP TABLE "MagicLink";

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "purpose" "ResetTokenPurpose" NOT NULL DEFAULT 'PASSWORD_RESET',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_email_createdAt_idx" ON "PasswordResetToken"("email", "createdAt");

