const config = require('../config');
const Embeds = require('./embeds');

/**
 * Sends a moderation log embed to the leader_notes channel.
 * Silently no-ops if the channel is not configured or cannot be fetched.
 *
 * @param {import('discord.js').Client} client
 * @param {object} opts
 * @param {string}  opts.label      - Command label for console messages (e.g. 'Ban')
 * @param {string}  opts.title      - Embed title
 * @param {string}  opts.color      - Embed color
 * @param {import('discord.js').GuildMember} opts.target
 * @param {import('discord.js').GuildMember} opts.moderator
 * @param {Array}   [opts.fields]   - Extra embed fields
 */
async function sendModerationLog(client, { label, title, color, target, moderator, fields = [] }) {
  const logChannelId = config.channel.leader_notes;
  try {
    const logChannel = logChannelId
      ? await client.channels.fetch(logChannelId)
      : null;

    if (logChannel) {
      await logChannel.send({
        embeds: [
          Embeds.modLog({ title, color, target, moderator, fields }),
        ],
      });
    } else {
      console.warn(`[${label}] leader_notes channel not found or not configured.`);
    }
  } catch (err) {
    console.error(`[${label}] Failed to send log:`, err);
  }
}

module.exports = { sendModerationLog };
