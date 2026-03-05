-- DropIndex
DROP INDEX "UserRank_guildId_messageCount_idx";

-- AlterTable
ALTER TABLE "UserRank" ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "UserRank_guildId_xp_idx" ON "UserRank"("guildId", "xp" DESC);
