-- CreateTable: central GuildMember (replaces UserRank, UserFlair, KickCooldown)
CREATE TABLE "GuildMember" (
    "userId"       TEXT         NOT NULL,
    "guildId"      TEXT         NOT NULL,
    "messageCount" INTEGER      NOT NULL DEFAULT 0,
    "xp"           INTEGER      NOT NULL DEFAULT 0,
    "rankLevel"    INTEGER      NOT NULL DEFAULT 1,
    "flair"        TEXT,
    "kickLastAt"   TIMESTAMP(3),
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT NOW(),

    CONSTRAINT "GuildMember_pkey" PRIMARY KEY ("userId", "guildId")
);

CREATE INDEX "GuildMember_guildId_xp_idx" ON "GuildMember"("guildId", "xp" DESC);

-- DataMigration: seed GuildMember from all existing user-bearing tables
-- (target users + moderators — order doesn't matter, ON CONFLICT skips dupes)
INSERT INTO "GuildMember" ("userId", "guildId", "updatedAt")
SELECT DISTINCT "userId", "guildId", NOW() FROM "UserRank"
UNION
SELECT DISTINCT "userId", "guildId", NOW() FROM "UserFlair"
UNION
SELECT DISTINCT "userId", "guildId", NOW() FROM "KickCooldown"
UNION
SELECT DISTINCT "userId", "guildId", NOW() FROM "Mute"
UNION
SELECT DISTINCT "userId", "guildId", NOW() FROM "KickLog"
UNION
SELECT DISTINCT "userId", "guildId", NOW() FROM "WarnLog"
UNION
SELECT DISTINCT "userId", "guildId", NOW() FROM "BanLog"
UNION
SELECT DISTINCT "moderatorId", "guildId", NOW() FROM "Mute"
UNION
SELECT DISTINCT "moderatorId", "guildId", NOW() FROM "KickLog"
UNION
SELECT DISTINCT "moderatorId", "guildId", NOW() FROM "WarnLog"
UNION
SELECT DISTINCT "moderatorId", "guildId", NOW() FROM "BanLog"
ON CONFLICT ("userId", "guildId") DO NOTHING;

-- DataMigration: copy state from old tables into GuildMember
UPDATE "GuildMember" gm SET
    "messageCount" = ur."messageCount",
    "xp"           = ur."xp",
    "rankLevel"    = ur."rankLevel"
FROM "UserRank" ur
WHERE gm."userId" = ur."userId" AND gm."guildId" = ur."guildId";

UPDATE "GuildMember" gm SET "flair" = uf."flair"
FROM "UserFlair" uf
WHERE gm."userId" = uf."userId" AND gm."guildId" = uf."guildId";

UPDATE "GuildMember" gm SET "kickLastAt" = kc."lastKickAt"
FROM "KickCooldown" kc
WHERE gm."userId" = kc."userId" AND gm."guildId" = kc."guildId";

-- AddForeignKeys on Mute (target + moderator)
ALTER TABLE "Mute"
    ADD CONSTRAINT "Mute_target_fkey"
    FOREIGN KEY ("userId", "guildId")
    REFERENCES "GuildMember"("userId", "guildId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Mute"
    ADD CONSTRAINT "Mute_moderator_fkey"
    FOREIGN KEY ("moderatorId", "guildId")
    REFERENCES "GuildMember"("userId", "guildId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKeys on KickLog
ALTER TABLE "KickLog"
    ADD CONSTRAINT "KickLog_target_fkey"
    FOREIGN KEY ("userId", "guildId")
    REFERENCES "GuildMember"("userId", "guildId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KickLog"
    ADD CONSTRAINT "KickLog_moderator_fkey"
    FOREIGN KEY ("moderatorId", "guildId")
    REFERENCES "GuildMember"("userId", "guildId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKeys on WarnLog
ALTER TABLE "WarnLog"
    ADD CONSTRAINT "WarnLog_target_fkey"
    FOREIGN KEY ("userId", "guildId")
    REFERENCES "GuildMember"("userId", "guildId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WarnLog"
    ADD CONSTRAINT "WarnLog_moderator_fkey"
    FOREIGN KEY ("moderatorId", "guildId")
    REFERENCES "GuildMember"("userId", "guildId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKeys on BanLog
ALTER TABLE "BanLog"
    ADD CONSTRAINT "BanLog_target_fkey"
    FOREIGN KEY ("userId", "guildId")
    REFERENCES "GuildMember"("userId", "guildId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BanLog"
    ADD CONSTRAINT "BanLog_moderator_fkey"
    FOREIGN KEY ("moderatorId", "guildId")
    REFERENCES "GuildMember"("userId", "guildId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey on ClanMember (nullable — only when userId/guildId are set)
ALTER TABLE "ClanMember"
    ADD CONSTRAINT "ClanMember_discordMember_fkey"
    FOREIGN KEY ("userId", "guildId")
    REFERENCES "GuildMember"("userId", "guildId")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- DropTables
DROP TABLE "UserRank";
DROP TABLE "UserFlair";
DROP TABLE "KickCooldown";
