const config = require('../config');

const DONATION_ACHIEVEMENT = config.clash.achievementName.donations; // 'Friend in Need'

/**
 * Returns the current season key as "YYYY-MM" (UTC).
 * @returns {string}
 */
function getCurrentSeasonKey() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Returns the season key for the month prior to the given key.
 * @param {string} seasonKey  "YYYY-MM"
 * @returns {string}
 */
function getPrevSeasonKey(seasonKey) {
  const [year, month] = seasonKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1)); // month-2 because month is 1-indexed
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Extracts the "Friend in Need" achievement value from a CoC player object.
 * Returns 0 if not found.
 * @param {object} player  CoC API player response
 * @returns {number}
 */
function getFriendInNeedValue(player) {
  const achievement = (player.achievements ?? []).find(a => a.name === DONATION_ACHIEVEMENT);
  return achievement?.value ?? 0;
}

/**
 * Formats a season key "YYYY-MM" into a human-readable string like "March 2026".
 * @param {string} seasonKey
 * @returns {string}
 */
function formatSeasonKey(seasonKey) {
  const [year, month] = seasonKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1))
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Returns a player's current-season donation count given their snapshot and
 * current "Friend in Need" achievement value.
 * @param {number} currentAchievement
 * @param {number} baselineAchievement
 * @returns {number}
 */
function calcSeasonDonations(currentAchievement, baselineAchievement) {
  return Math.max(0, currentAchievement - baselineAchievement);
}

/**
 * Normalises a CoC tag to uppercase with a leading #.
 * @param {string} raw
 * @returns {string}
 */
function normaliseTag(raw) {
  const t = raw.trim().toUpperCase();
  return t.startsWith('#') ? t : `#${t}`;
}

/**
 * Returns true if the string is a valid CoC player tag (# followed by 3–12 alphanumeric chars).
 * @param {string} tag  Should already be normalised (starts with #).
 * @returns {boolean}
 */
function isValidCocTag(tag) {
  return /^#[0-9A-Z]{3,12}$/.test(tag);
}

module.exports = {
  getCurrentSeasonKey,
  getPrevSeasonKey,
  getFriendInNeedValue,
  formatSeasonKey,
  calcSeasonDonations,
  normaliseTag,
  isValidCocTag,
};
