-- CreateTable
CREATE TABLE "UserRank" (
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "rankLevel" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRank_pkey" PRIMARY KEY ("userId","guildId")
);

-- CreateTable
CREATE TABLE "GuildRankConfig" (
    "guildId" TEXT NOT NULL,
    "rankLevel" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "GuildRankConfig_pkey" PRIMARY KEY ("guildId","rankLevel")
);

-- CreateIndex
CREATE INDEX "UserRank_guildId_messageCount_idx" ON "UserRank"("guildId", "messageCount" DESC);
