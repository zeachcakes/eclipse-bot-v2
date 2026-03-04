const config = require('../config');

// Ordered hierarchy — index 0 is highest rank
const HIERARCHY = ['co_leader', 'elder', 'eclipse'];

/**
 * Returns the member's highest role in the clan hierarchy, or null if none.
 * @param {import('discord.js').GuildMember} member
 * @returns {'co_leader' | 'elder' | 'eclipse' | null}
 */
function getHighestRole(member) {
  for (const rank of HIERARCHY) {
    if (config.role[rank] && member.roles.cache.has(config.role[rank])) {
      return rank;
    }
  }
  return null;
}

/**
 * Returns true if the member holds at least one of the given role keys.
 * @param {import('discord.js').GuildMember} member
 * @param {...string} roleKeys  Keys from config.role (e.g. 'co_leader', 'elder')
 */
function hasRole(member, ...roleKeys) {
  return roleKeys.some(key => config.role[key] && member.roles.cache.has(config.role[key]));
}

module.exports = { getHighestRole, hasRole };
