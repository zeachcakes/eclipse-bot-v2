-- GuildMember: central user table (xp/rank/flair/kick-cooldown per guild member)
CREATE TABLE "GuildMember" (
    "userId"       TEXT         NOT NULL,
    "guildId"      TEXT         NOT NULL,
    "messageCount" INTEGER      NOT NULL DEFAULT 0,
    "xp"           INTEGER      NOT NULL DEFAULT 0,
    "rankLevel"    INTEGER      NOT NULL DEFAULT 1,
    "flair"        TEXT,
    "kickLastAt"   TIMESTAMP(3),
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildMember_pkey" PRIMARY KEY ("userId", "guildId")
);

CREATE INDEX "GuildMember_guildId_xp_idx" ON "GuildMember"("guildId", "xp" DESC);

-- Mute: active and historical mutes; FKs to GuildMember for target and moderator
CREATE TABLE "Mute" (
    "id"          SERIAL       NOT NULL,
    "userId"      TEXT         NOT NULL,
    "guildId"     TEXT         NOT NULL,
    "moderatorId" TEXT         NOT NULL,
    "reason"      TEXT         NOT NULL,
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "active"      BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT NOW(),

    CONSTRAINT "Mute_pkey"                    PRIMARY KEY ("id"),
    CONSTRAINT "Mute_userId_guildId_fkey"     FOREIGN KEY ("userId",      "guildId") REFERENCES "GuildMember"("userId", "guildId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Mute_moderatorId_guildId_fkey" FOREIGN KEY ("moderatorId", "guildId") REFERENCES "GuildMember"("userId", "guildId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Mute_userId_guildId_idx"   ON "Mute"("userId", "guildId");
CREATE INDEX "Mute_active_expiresAt_idx" ON "Mute"("active", "expiresAt");

-- KickLog: kick audit log
CREATE TABLE "KickLog" (
    "id"          SERIAL       NOT NULL,
    "userId"      TEXT         NOT NULL,
    "guildId"     TEXT         NOT NULL,
    "moderatorId" TEXT         NOT NULL,
    "reason"      TEXT         NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT NOW(),

    CONSTRAINT "KickLog_pkey"                    PRIMARY KEY ("id"),
    CONSTRAINT "KickLog_userId_guildId_fkey"     FOREIGN KEY ("userId",      "guildId") REFERENCES "GuildMember"("userId", "guildId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KickLog_moderatorId_guildId_fkey" FOREIGN KEY ("moderatorId", "guildId") REFERENCES "GuildMember"("userId", "guildId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "KickLog_userId_guildId_idx" ON "KickLog"("userId", "guildId");

-- WarnLog: warning audit log
CREATE TABLE "WarnLog" (
    "id"          SERIAL       NOT NULL,
    "userId"      TEXT         NOT NULL,
    "guildId"     TEXT         NOT NULL,
    "moderatorId" TEXT         NOT NULL,
    "reason"      TEXT         NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT NOW(),

    CONSTRAINT "WarnLog_pkey"                    PRIMARY KEY ("id"),
    CONSTRAINT "WarnLog_userId_guildId_fkey"     FOREIGN KEY ("userId",      "guildId") REFERENCES "GuildMember"("userId", "guildId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WarnLog_moderatorId_guildId_fkey" FOREIGN KEY ("moderatorId", "guildId") REFERENCES "GuildMember"("userId", "guildId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "WarnLog_userId_guildId_idx" ON "WarnLog"("userId", "guildId");

-- GuildRankConfig: server-specific rank name overrides
CREATE TABLE "GuildRankConfig" (
    "guildId"   TEXT    NOT NULL,
    "rankLevel" INTEGER NOT NULL,
    "name"      TEXT    NOT NULL,

    CONSTRAINT "GuildRankConfig_pkey" PRIMARY KEY ("guildId", "rankLevel")
);

-- GuildFlairPool: available flairs per guild
CREATE TABLE "GuildFlairPool" (
    "guildId" TEXT NOT NULL,
    "emoji"   TEXT NOT NULL,
    "label"   TEXT,

    CONSTRAINT "GuildFlairPool_pkey" PRIMARY KEY ("guildId", "emoji")
);

-- GuildSetting: per-guild bot configuration
CREATE TABLE "GuildSetting" (
    "guildId"    TEXT    NOT NULL,
    "banGifMode" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "GuildSetting_pkey" PRIMARY KEY ("guildId")
);

-- BanLog: ban audit log
CREATE TABLE "BanLog" (
    "id"          SERIAL       NOT NULL,
    "userId"      TEXT         NOT NULL,
    "guildId"     TEXT         NOT NULL,
    "moderatorId" TEXT         NOT NULL,
    "reason"      TEXT         NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT NOW(),

    CONSTRAINT "BanLog_pkey"                    PRIMARY KEY ("id"),
    CONSTRAINT "BanLog_userId_guildId_fkey"     FOREIGN KEY ("userId",      "guildId") REFERENCES "GuildMember"("userId", "guildId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BanLog_moderatorId_guildId_fkey" FOREIGN KEY ("moderatorId", "guildId") REFERENCES "GuildMember"("userId", "guildId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "BanLog_userId_guildId_idx" ON "BanLog"("userId", "guildId");

-- ClanMember: Clash of Clans clan roster (both Eclipse and THS)
CREATE TABLE "ClanMember" (
    "playerTag"  TEXT         NOT NULL,
    "playerName" TEXT,
    "clanTag"    TEXT,
    "userId"     TEXT,
    "guildId"    TEXT,
    "linkedAt"   TIMESTAMP(3),
    "leftAt"     TIMESTAMP(3),
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClanMember_pkey"             PRIMARY KEY ("playerTag"),
    CONSTRAINT "ClanMember_userId_guildId_fkey" FOREIGN KEY ("userId", "guildId") REFERENCES "GuildMember"("userId", "guildId") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ClanMember_userId_idx"  ON "ClanMember"("userId");
CREATE INDEX "ClanMember_clanTag_idx" ON "ClanMember"("clanTag");
CREATE INDEX "ClanMember_leftAt_idx"  ON "ClanMember"("leftAt");

-- DonationSeasonSnapshot: per-player per-season donation tracking
CREATE TABLE "DonationSeasonSnapshot" (
    "playerTag"              TEXT         NOT NULL,
    "seasonKey"              TEXT         NOT NULL,
    "baselineAchievement"    INTEGER      NOT NULL,
    "currentSeasonDonations" INTEGER      NOT NULL DEFAULT 0,
    "finalDonations"         INTEGER,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT NOW(),

    CONSTRAINT "DonationSeasonSnapshot_pkey"          PRIMARY KEY ("playerTag", "seasonKey"),
    CONSTRAINT "DonationSeasonSnapshot_playerTag_fkey" FOREIGN KEY ("playerTag") REFERENCES "ClanMember"("playerTag") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DonationSeasonSnapshot_seasonKey_idx" ON "DonationSeasonSnapshot"("seasonKey");
CREATE INDEX "DonationSeasonSnapshot_playerTag_idx" ON "DonationSeasonSnapshot"("playerTag");
