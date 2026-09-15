-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'BUSINESS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isVip" BOOLEAN NOT NULL DEFAULT false,
    "accessExpiresAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'none',
    "trialEndsAt" TIMESTAMP(3),
    "profession" TEXT,
    "professionRaw" TEXT,
    "clientType" TEXT,
    "professionText" TEXT,
    "targetIndustry" TEXT,
    "targetRegion" TEXT,
    "digestFoundedAt" TIMESTAMP(3),
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "targetFilters" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "onboardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Search" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "name" TEXT,
    "filters" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scenario" TEXT,
    "districts" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "savedId" TEXT,
    "lastOpenedAt" TIMESTAMP(3),
    "origin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Search_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "region" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "foundCount" INTEGER NOT NULL DEFAULT 0,
    "targetCount" INTEGER NOT NULL DEFAULT 500,
    "stageIndex" INTEGER NOT NULL DEFAULT 0,
    "stageCount" INTEGER NOT NULL DEFAULT 1,
    "stageLabel" TEXT,
    "webSearchCount" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessResult" (
    "id" TEXT NOT NULL,
    "searchId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "ruianCode" INTEGER,
    "website" TEXT,
    "ico" TEXT,
    "foundedAt" TIMESTAMP(3),
    "vatPayer" BOOLEAN,
    "vatUnreliable" BOOLEAN,
    "legalForm" TEXT,
    "nace" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "trades" JSONB,
    "employeeCategory" TEXT,
    "inInsolvency" BOOLEAN,
    "registryUpdatedAt" TIMESTAMP(3),
    "activePremises" INTEGER,
    "hasWebsite" BOOLEAN NOT NULL DEFAULT false,
    "websiteStatus" TEXT,
    "websiteEvidence" TEXT NOT NULL DEFAULT '',
    "hasFacebook" BOOLEAN NOT NULL DEFAULT false,
    "hasInstagram" BOOLEAN NOT NULL DEFAULT false,
    "hasLinkedIn" BOOLEAN NOT NULL DEFAULT false,
    "socialsChecked" BOOLEAN NOT NULL DEFAULT false,
    "contactUrl" TEXT,
    "contactFoundAt" TIMESTAMP(3),
    "matchedBy" TEXT,
    "facebookUrl" TEXT,
    "instagramUrl" TEXT,
    "linkedInUrl" TEXT,
    "websiteIsOld" BOOLEAN NOT NULL DEFAULT false,
    "websiteScore" INTEGER NOT NULL DEFAULT 50,
    "websiteAgeNote" TEXT NOT NULL DEFAULT '',
    "leadScore" INTEGER NOT NULL DEFAULT 0,
    "googleMapsUrl" TEXT,
    "category" TEXT,
    "source" TEXT NOT NULL DEFAULT 'google',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "usedBy" TEXT,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "accessDurationMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnonymousHit" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnonymousHit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "firmKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrySubject" (
    "ico" TEXT NOT NULL,
    "foundedAt" TIMESTAMP(3) NOT NULL,
    "legalForm" TEXT NOT NULL,
    "nace" TEXT,
    "employeeCategory" TEXT,
    "district" TEXT NOT NULL,
    "municipality" INTEGER,
    "registryUpdatedAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3) NOT NULL,
    "firstSeenAt" TIMESTAMP(3),

    CONSTRAINT "RegistrySubject_pkey" PRIMARY KEY ("ico")
);

-- CreateTable
CREATE TABLE "RegistryFeedBatch" (
    "source" TEXT NOT NULL,
    "batchNo" INTEGER NOT NULL,
    "releasedAt" TIMESTAMP(3) NOT NULL,
    "inserted" INTEGER NOT NULL DEFAULT 0,
    "deleted" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistryFeedBatch_pkey" PRIMARY KEY ("source","batchNo")
);

-- CreateTable
CREATE TABLE "RegistryImport" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "cursorIco" TEXT,
    "cursorByte" INTEGER,
    "scanned" INTEGER NOT NULL DEFAULT 0,
    "kept" INTEGER NOT NULL DEFAULT 0,
    "snapshotAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "RegistryImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Optout" (
    "id" TEXT NOT NULL,
    "firmKey" TEXT NOT NULL,
    "email" TEXT,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "Optout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadTag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessResultId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnmatchedPayment" (
    "id" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "email" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "UnmatchedPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebSearchCall" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebSearchCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Search_userId_savedId_createdAt_idx" ON "Search"("userId", "savedId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SearchJob_searchId_key" ON "SearchJob"("searchId");

-- CreateIndex
CREATE INDEX "SearchJob_userId_createdAt_idx" ON "SearchJob"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SearchJob_status_updatedAt_idx" ON "SearchJob"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");

-- CreateIndex
CREATE INDEX "AnonymousHit_ipHash_kind_createdAt_idx" ON "AnonymousHit"("ipHash", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "AnonymousHit_createdAt_idx" ON "AnonymousHit"("createdAt");

-- CreateIndex
CREATE INDEX "Claim_firmKey_createdAt_idx" ON "Claim"("firmKey", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_firmKey_userId_key" ON "Claim"("firmKey", "userId");

-- CreateIndex
CREATE INDEX "RegistrySubject_district_foundedAt_idx" ON "RegistrySubject"("district", "foundedAt");

-- CreateIndex
CREATE INDEX "RegistrySubject_firstSeenAt_idx" ON "RegistrySubject"("firstSeenAt");

-- CreateIndex
CREATE INDEX "RegistrySubject_nace_foundedAt_idx" ON "RegistrySubject"("nace", "foundedAt");

-- CreateIndex
CREATE INDEX "RegistrySubject_importedAt_idx" ON "RegistrySubject"("importedAt");

-- CreateIndex
CREATE INDEX "RegistryImport_startedAt_idx" ON "RegistryImport"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordReset_userId_idx" ON "PasswordReset"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Optout_firmKey_key" ON "Optout"("firmKey");

-- CreateIndex
CREATE UNIQUE INDEX "Optout_token_key" ON "Optout"("token");

-- CreateIndex
CREATE INDEX "Optout_status_idx" ON "Optout"("status");

-- CreateIndex
CREATE INDEX "LeadTag_userId_status_idx" ON "LeadTag"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LeadTag_userId_businessResultId_key" ON "LeadTag"("userId", "businessResultId");

-- CreateIndex
CREATE INDEX "StripeEvent_processedAt_idx" ON "StripeEvent"("processedAt");

-- CreateIndex
CREATE INDEX "UnmatchedPayment_createdAt_idx" ON "UnmatchedPayment"("createdAt");

-- CreateIndex
CREATE INDEX "WebSearchCall_at_idx" ON "WebSearchCall"("at");

-- AddForeignKey
ALTER TABLE "Search" ADD CONSTRAINT "Search_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Search" ADD CONSTRAINT "Search_savedId_fkey" FOREIGN KEY ("savedId") REFERENCES "Search"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchJob" ADD CONSTRAINT "SearchJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchJob" ADD CONSTRAINT "SearchJob_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "Search"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessResult" ADD CONSTRAINT "BusinessResult_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "Search"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_usedBy_fkey" FOREIGN KEY ("usedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadTag" ADD CONSTRAINT "LeadTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadTag" ADD CONSTRAINT "LeadTag_businessResultId_fkey" FOREIGN KEY ("businessResultId") REFERENCES "BusinessResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

