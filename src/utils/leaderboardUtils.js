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

/**
 * Resolves the `target` and `count` options for commands that support both a
 * leaderboard view and a single-player lookup.
 *
 * Handles the prefix-command limitation where `count` can't be passed without
 * also occupying the `target` slot positionally. Supported aliases:
 *
 *   ~cmd 20          → leaderboard, count=20   (bare integer as target)
 *   ~cmd top 20      → leaderboard, count=20   (keyword "top" + count arg)
 *   ~cmd top         → leaderboard, count=default
 *   ~cmd @user       → single-player lookup
 *   ~cmd #TAG        → single-player lookup
 *
 * @param {{ target: string|null, count: number|null }} opts
 * @param {number} [defaultCount=10]
 * @returns {{ isLeaderboard: boolean, target: string|null, count: number }}
 */
function resolveLeaderboardOptions({ target, count }, defaultCount = 10) {
  // Bare integer as target → treat as count
  if (target !== null && /^\d+$/.test(target.trim())) {
    return { isLeaderboard: true, target: null, count: parseInt(target, 10) };
  }

  // "top [N]" keyword alias
  if (target?.toLowerCase() === 'top') {
    return { isLeaderboard: true, target: null, count: count ?? defaultCount };
  }

  // No target → leaderboard with default or supplied count
  if (target === null) {
    return { isLeaderboard: true, target: null, count: count ?? defaultCount };
  }

  // Actual lookup target
  return { isLeaderboard: false, target, count: count ?? defaultCount };
}

module.exports = { formatLeaderboardRow, formatRequesterLine, resolveLeaderboardOptions };
