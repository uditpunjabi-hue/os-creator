-- CreateEnum
CREATE TYPE "DealActivityKind" AS ENUM ('NOTE', 'STAGE_CHANGE', 'EMAIL_SENT', 'EMAIL_RECEIVED', 'OFFER_CHANGE', 'CALL_LOGGED', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "PaymentReminderChannel" AS ENUM ('EMAIL', 'IN_APP');

-- CreateEnum
CREATE TYPE "EmailTemplateKind" AS ENUM ('INTERESTED', 'NOT_INTERESTED', 'COUNTER_OFFER', 'FOLLOW_UP', 'PAYMENT_REMINDER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ContentPieceStatus" AS ENUM ('IDEA', 'FILMING', 'EDITING', 'READY', 'SCHEDULED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ScheduledPostStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "ScheduledPostKind" AS ENUM ('IMAGE', 'CAROUSEL', 'REEL', 'STORY');

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "deadline" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DealActivity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "kind" "DealActivityKind" NOT NULL DEFAULT 'NOTE',
    "body" TEXT NOT NULL,
    "meta" JSONB,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReminder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "brandCommercialId" TEXT NOT NULL,
    "channel" "PaymentReminderChannel" NOT NULL DEFAULT 'EMAIL',
    "subject" TEXT,
    "body" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "EmailTemplateKind" NOT NULL DEFAULT 'CUSTOM',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPiece" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scriptId" TEXT,
    "title" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'Reel',
    "status" "ContentPieceStatus" NOT NULL DEFAULT 'IDEA',
    "hook" TEXT,
    "body" TEXT,
    "cta" TEXT,
    "caption" TEXT,
    "hashtags" TEXT[],
    "checklist" JSONB,
    "mediaUrl" TEXT,
    "thumbnailUrl" TEXT,
    "approvedAt" TIMESTAMP(3),
    "filmedAt" TIMESTAMP(3),
    "editedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPiece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateCard" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reelRate" DECIMAL(12,2),
    "storyRate" DECIMAL(12,2),
    "carouselRate" DECIMAL(12,2),
    "ugcRate" DECIMAL(12,2),
    "brandIntegRate" DECIMAL(12,2),
    "exclusivityRate" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledPost" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "kind" "ScheduledPostKind" NOT NULL DEFAULT 'IMAGE',
    "platforms" TEXT[],
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "status" "ScheduledPostStatus" NOT NULL DEFAULT 'SCHEDULED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealActivity_organizationId_idx" ON "DealActivity"("organizationId");

-- CreateIndex
CREATE INDEX "DealActivity_dealId_idx" ON "DealActivity"("dealId");

-- CreateIndex
CREATE INDEX "DealActivity_createdAt_idx" ON "DealActivity"("createdAt");

-- CreateIndex
CREATE INDEX "PaymentReminder_organizationId_idx" ON "PaymentReminder"("organizationId");

-- CreateIndex
CREATE INDEX "PaymentReminder_brandCommercialId_idx" ON "PaymentReminder"("brandCommercialId");

-- CreateIndex
CREATE INDEX "EmailTemplate_organizationId_idx" ON "EmailTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "EmailTemplate_kind_idx" ON "EmailTemplate"("kind");

-- CreateIndex
CREATE INDEX "ContentPiece_organizationId_idx" ON "ContentPiece"("organizationId");

-- CreateIndex
CREATE INDEX "ContentPiece_status_idx" ON "ContentPiece"("status");

-- CreateIndex
CREATE INDEX "ContentPiece_scriptId_idx" ON "ContentPiece"("scriptId");

-- CreateIndex
CREATE UNIQUE INDEX "RateCard_organizationId_key" ON "RateCard"("organizationId");

-- CreateIndex
CREATE INDEX "ScheduledPost_organizationId_idx" ON "ScheduledPost"("organizationId");

-- CreateIndex
CREATE INDEX "ScheduledPost_influencerId_idx" ON "ScheduledPost"("influencerId");

-- CreateIndex
CREATE INDEX "ScheduledPost_scheduledAt_idx" ON "ScheduledPost"("scheduledAt");

-- CreateIndex
CREATE INDEX "ScheduledPost_status_idx" ON "ScheduledPost"("status");

-- AddForeignKey
ALTER TABLE "DealActivity" ADD CONSTRAINT "DealActivity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealActivity" ADD CONSTRAINT "DealActivity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReminder" ADD CONSTRAINT "PaymentReminder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReminder" ADD CONSTRAINT "PaymentReminder_brandCommercialId_fkey" FOREIGN KEY ("brandCommercialId") REFERENCES "BrandCommercial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPiece" ADD CONSTRAINT "ContentPiece_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPiece" ADD CONSTRAINT "ContentPiece_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateCard" ADD CONSTRAINT "RateCard_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPost" ADD CONSTRAINT "ScheduledPost_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledPost" ADD CONSTRAINT "ScheduledPost_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
