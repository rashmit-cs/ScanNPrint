-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "accountDeletedAt" TIMESTAMP(3),
ADD COLUMN     "otpAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "otpLastSentAt" TIMESTAMP(3),
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DeletedIdentity" (
    "id" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "phoneHash" TEXT,
    "trialUsed" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeletedIdentity_emailHash_idx" ON "DeletedIdentity"("emailHash");

-- CreateIndex
CREATE INDEX "DeletedIdentity_phoneHash_idx" ON "DeletedIdentity"("phoneHash");
