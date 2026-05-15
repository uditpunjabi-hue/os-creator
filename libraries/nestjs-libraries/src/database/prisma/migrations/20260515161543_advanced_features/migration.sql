-- CreateEnum
CREATE TYPE "ContentIdeaStatus" AS ENUM ('NEW', 'SAVED', 'DISMISSED', 'USED');

-- CreateEnum
CREATE TYPE "ContentIdeaSource" AS ENUM ('TRENDING', 'INSPIRATION', 'SEASONAL', 'TOP_PERFORMING', 'EVERGREEN');

-- CreateEnum
CREATE TYPE "BrandContactStatus" AS ENUM ('NEW', 'ACTIVE', 'DORMANT', 'CHURNED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "UserNotificationKind" AS ENUM ('NEW_EMAIL', 'DEAL_DEADLINE', 'PAYMENT_OVERDUE', 'SCRIPT_READY', 'WEEKLY_REPORT_READY', 'POST_MILESTONE', 'IDEAS_REFRESHED', 'SYSTEM');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "prefsLanguage" TEXT;
ALTER TABLE "User" ADD COLUMN "prefsTheme" TEXT;

-- CreateTable
CREATE TABLE "ContentIdea" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hook" TEXT,
    "format" TEXT NOT NULL DEFAULT 'Reel',
    "estimatedEngagement" DOUBLE PRECISION,
    "source" "ContentIdeaSource" NOT NULL DEFAULT 'TRENDING',
    "rationale" TEXT,
    "status" "ContentIdeaStatus" NOT NULL DEFAULT 'NEW',
    "weekOf" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentIdea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HashtagSet" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "topic" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HashtagSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedCaption" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT,
    "tone" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedCaption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandContact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "status" "BrandContactStatus" NOT NULL DEFAULT 'NEW',
    "totalEarned" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "lastInteraction" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "brandEmail" TEXT,
    "brandAddress" TEXT,
    "fromName" TEXT,
    "fromEmail" TEXT,
    "fromAddress" TEXT,
    "items" JSONB NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "terms" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "dueAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "UserNotificationKind" NOT NULL DEFAULT 'SYSTEM',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentIdea_organizationId_idx" ON "ContentIdea"("organizationId");
CREATE INDEX "ContentIdea_userId_idx" ON "ContentIdea"("userId");
CREATE INDEX "ContentIdea_weekOf_idx" ON "ContentIdea"("weekOf");
CREATE INDEX "ContentIdea_status_idx" ON "ContentIdea"("status");

CREATE INDEX "HashtagSet_organizationId_idx" ON "HashtagSet"("organizationId");
CREATE INDEX "HashtagSet_userId_idx" ON "HashtagSet"("userId");

CREATE INDEX "SavedCaption_organizationId_idx" ON "SavedCaption"("organizationId");
CREATE INDEX "SavedCaption_userId_idx" ON "SavedCaption"("userId");

CREATE UNIQUE INDEX "BrandContact_organizationId_contactEmail_key" ON "BrandContact"("organizationId", "contactEmail");
CREATE INDEX "BrandContact_organizationId_idx" ON "BrandContact"("organizationId");
CREATE INDEX "BrandContact_status_idx" ON "BrandContact"("status");

CREATE INDEX "Invoice_organizationId_idx" ON "Invoice"("organizationId");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_brandName_idx" ON "Invoice"("brandName");

CREATE INDEX "UserNotification_userId_idx" ON "UserNotification"("userId");
CREATE INDEX "UserNotification_readAt_idx" ON "UserNotification"("readAt");
CREATE INDEX "UserNotification_createdAt_idx" ON "UserNotification"("createdAt");

-- AddForeignKey
ALTER TABLE "ContentIdea" ADD CONSTRAINT "ContentIdea_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ContentIdea" ADD CONSTRAINT "ContentIdea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HashtagSet" ADD CONSTRAINT "HashtagSet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HashtagSet" ADD CONSTRAINT "HashtagSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SavedCaption" ADD CONSTRAINT "SavedCaption_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SavedCaption" ADD CONSTRAINT "SavedCaption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BrandContact" ADD CONSTRAINT "BrandContact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
