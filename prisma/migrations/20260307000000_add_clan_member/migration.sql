-- CreateTable
CREATE TABLE "ClanMember" (
    "playerTag"  TEXT NOT NULL,
    "playerName" TEXT,
    "clanTag"    TEXT,
    "userId"     TEXT,
    "guildId"    TEXT,
    "linkedAt"   TIMESTAMP(3),
    "leftAt"     TIMESTAMP(3),
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT NOW(),

    CONSTRAINT "ClanMember_pkey" PRIMARY KEY ("playerTag")
);

-- CreateIndex
CREATE INDEX "ClanMember_userId_idx" ON "ClanMember"("userId");
CREATE INDEX "ClanMember_clanTag_idx" ON "ClanMember"("clanTag");
CREATE INDEX "ClanMember_leftAt_idx" ON "ClanMember"("leftAt");

-- DataMigration: copy existing PlayerLink rows into ClanMember (preserves Discord links)
INSERT INTO "ClanMember" ("playerTag", "userId", "guildId", "linkedAt", "updatedAt")
SELECT "playerTag", "userId", "guildId", "createdAt", NOW()
FROM "PlayerLink"
ON CONFLICT ("playerTag") DO NOTHING;

-- DataMigration: ensure any DonationSeasonSnapshot playerTags not covered above have a ClanMember row
INSERT INTO "ClanMember" ("playerTag", "updatedAt")
SELECT DISTINCT "playerTag", NOW()
FROM "DonationSeasonSnapshot"
WHERE "playerTag" NOT IN (SELECT "playerTag" FROM "ClanMember")
ON CONFLICT ("playerTag") DO NOTHING;

-- AddForeignKey
ALTER TABLE "DonationSeasonSnapshot"
    ADD CONSTRAINT "DonationSeasonSnapshot_playerTag_fkey"
    FOREIGN KEY ("playerTag") REFERENCES "ClanMember"("playerTag")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- DropTable
DROP TABLE "PlayerLink";
