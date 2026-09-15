-- AlterTable
ALTER TABLE "BusinessResult" ADD COLUMN     "adsCount" INTEGER,
ADD COLUMN     "adsLinkDomain" TEXT,
ADD COLUMN     "adsPageId" TEXT,
ADD COLUMN     "adsPageName" TEXT,
ADD COLUMN     "adsReach" INTEGER,
ADD COLUMN     "adsSince" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MetaAdvertiser" (
    "query" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "payer" TEXT,
    "linkDomain" TEXT,
    "adCount" INTEGER NOT NULL,
    "firstSeenAt" TIMESTAMP(3),
    "reach" INTEGER,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaAdvertiser_pkey" PRIMARY KEY ("query","pageId")
);
