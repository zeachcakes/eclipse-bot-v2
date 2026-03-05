CREATE TABLE IF NOT EXISTS "GuildSetting" (
    "guildId" TEXT NOT NULL,
    "banGifMode" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "GuildSetting_pkey" PRIMARY KEY ("guildId")
);

CREATE TABLE IF NOT EXISTS "BanLog" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BanLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BanLog_userId_guildId_idx" ON "BanLog"("userId", "guildId");
