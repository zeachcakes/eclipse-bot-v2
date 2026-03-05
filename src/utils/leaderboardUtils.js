/**
 * Shared leaderboard formatting utilities.
 *
 * Row format (mirrors the XP leaderboard style):
 *   `02   1.2K xp  (Stargazer)          |`  🌙 DisplayName
 *
 * Callers build the `statPart` string (padding included) and pass it in.
 */

/**
 * Builds a single leaderboard row string.
 *
 * @param {number}      pos       1-based position
 * @param {string}      statPart  Pre-formatted, padded stat string (no backticks)
 * @param {string}      baseName  Display name to show after the stats block
 * @param {string|null} flair     Flair emoji, or null/undefined
 * @returns {string}
 */
function formatLeaderboardRow(pos, statPart, baseName, flair) {
  const posStr = String(pos).padStart(2);
  const name   = flair ? `${flair} ${baseName}` : baseName;
  return `\`${posStr}  ${statPart} |\`  ${name}`;
}

/**
 * Formats a "Requested by …" footer line (Eastern time).
 *
 * @param {import('discord.js').GuildMember} member
 * @returns {string}
 */
function formatRequesterLine(member) {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' });
  return `Requested by ${member.displayName} on ${dateStr} at ${timeStr} EST`;
}

module.exports = { formatLeaderboardRow, formatRequesterLine };
