const prisma = require('../lib/prisma');

/**
 * Returns the flair emoji string for a user in a guild, or null if none set.
 * @param {string} userId
 * @param {string} guildId
 * @returns {Promise<string|null>}
 */
async function getUserFlair(userId, guildId) {
  const record = await prisma.userFlair.findUnique({
    where: { userId_guildId: { userId, guildId } },
  });
  return record?.flair ?? null;
}

/**
 * Batch-fetches flairs for a list of user IDs in a guild.
 * @param {string[]} userIds
 * @param {string} guildId
 * @returns {Promise<Map<string, string>>} Map of userId → flair emoji
 */
async function getFlairsForUsers(userIds, guildId) {
  const records = await prisma.userFlair.findMany({
    where: { guildId, userId: { in: userIds } },
  });
  return new Map(records.map(r => [r.userId, r.flair]));
}

module.exports = { getUserFlair, getFlairsForUsers };
