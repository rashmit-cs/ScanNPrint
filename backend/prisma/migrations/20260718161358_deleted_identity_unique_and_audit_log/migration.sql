/*
  Warnings:

  - A unique constraint covering the columns `[emailHash]` on the table `DeletedIdentity` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "DeletedIdentity_emailHash_idx";

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "shopId" TEXT,
    "event" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_shopId_idx" ON "AuditLog"("shopId");

-- CreateIndex
CREATE INDEX "AuditLog_event_idx" ON "AuditLog"("event");

-- CreateIndex
CREATE UNIQUE INDEX "DeletedIdentity_emailHash_key" ON "DeletedIdentity"("emailHash");
