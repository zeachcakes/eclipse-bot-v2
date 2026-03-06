-- AlterTable
ALTER TABLE "ClanMember" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GuildMember" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameForeignKey
ALTER TABLE "BanLog" RENAME CONSTRAINT "BanLog_moderator_fkey" TO "BanLog_moderatorId_guildId_fkey";

-- RenameForeignKey
ALTER TABLE "BanLog" RENAME CONSTRAINT "BanLog_target_fkey" TO "BanLog_userId_guildId_fkey";

-- RenameForeignKey
ALTER TABLE "ClanMember" RENAME CONSTRAINT "ClanMember_discordMember_fkey" TO "ClanMember_userId_guildId_fkey";

-- RenameForeignKey
ALTER TABLE "KickLog" RENAME CONSTRAINT "KickLog_moderator_fkey" TO "KickLog_moderatorId_guildId_fkey";

-- RenameForeignKey
ALTER TABLE "KickLog" RENAME CONSTRAINT "KickLog_target_fkey" TO "KickLog_userId_guildId_fkey";

-- RenameForeignKey
ALTER TABLE "Mute" RENAME CONSTRAINT "Mute_moderator_fkey" TO "Mute_moderatorId_guildId_fkey";

-- RenameForeignKey
ALTER TABLE "Mute" RENAME CONSTRAINT "Mute_target_fkey" TO "Mute_userId_guildId_fkey";

-- RenameForeignKey
ALTER TABLE "WarnLog" RENAME CONSTRAINT "WarnLog_moderator_fkey" TO "WarnLog_moderatorId_guildId_fkey";

-- RenameForeignKey
ALTER TABLE "WarnLog" RENAME CONSTRAINT "WarnLog_target_fkey" TO "WarnLog_userId_guildId_fkey";
