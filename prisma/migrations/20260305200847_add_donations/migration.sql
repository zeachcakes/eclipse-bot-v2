-- CreateTable
CREATE TABLE "GuildSetting" (
    "guildId" TEXT NOT NULL,
    "banGifMode" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "GuildSetting_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "BanLog" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BanLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerLink" (
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "playerTag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerLink_pkey" PRIMARY KEY ("userId","guildId")
);

-- CreateTable
CREATE TABLE "DonationSeasonSnapshot" (
    "playerTag" TEXT NOT NULL,
    "seasonKey" TEXT NOT NULL,
    "baselineAchievement" INTEGER NOT NULL,
    "finalDonations" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonationSeasonSnapshot_pkey" PRIMARY KEY ("playerTag","seasonKey")
);

-- CreateIndex
CREATE INDEX "BanLog_userId_guildId_idx" ON "BanLog"("userId", "guildId");

-- CreateIndex
CREATE INDEX "PlayerLink_playerTag_idx" ON "PlayerLink"("playerTag");

-- CreateIndex
CREATE INDEX "DonationSeasonSnapshot_seasonKey_idx" ON "DonationSeasonSnapshot"("seasonKey");
