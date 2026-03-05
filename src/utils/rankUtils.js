const { RANKS } = require('../config/ranks');
const prisma = require('../lib/prisma');

/**
 * Returns the rank definition the user currently holds based on total XP.
 * @param {number} xp
 */
function getRankForXp(xp) {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (xp >= r.threshold) rank = r;
  }
  return rank;
}

/**
 * Returns the next rank above the given level, or null if already at max.
 * @param {number} level
 */
function getNextRank(level) {
  return RANKS.find(r => r.level === level + 1) ?? null;
}

/**
 * Fetches all guild rank name overrides and returns a merged array of ranks
 * with effectiveName set to the custom name if one exists, otherwise the default.
 * Batches into a single DB query — use this when you need names for multiple ranks.
 * @param {string} guildId
 * @returns {Promise<Array<{ level, name, threshold, color, effectiveName }>>}
 */
async function getAllEffectiveRanks(guildId) {
  const overrides = await prisma.guildRankConfig.findMany({ where: { guildId } });
  const overrideMap = Object.fromEntries(overrides.map(o => [o.rankLevel, o.name]));
  return RANKS.map(r => ({ ...r, effectiveName: overrideMap[r.level] ?? r.name }));
}

/**
 * Builds a text progress bar.
 * @param {number} current
 * @param {number} min  Threshold of current rank
 * @param {number} max  Threshold of next rank
 * @param {number} [length=14]
 */
function buildProgressBar(current, min, max, length = 14) {
  const progress = Math.min((current - min) / (max - min), 1);
  const filled = Math.round(progress * length);
  return `\`[${'▓'.repeat(filled)}${'░'.repeat(length - filled)}]\``;
}

module.exports = { getRankForXp, getNextRank, getAllEffectiveRanks, buildProgressBar };
