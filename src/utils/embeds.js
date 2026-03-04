const { EmbedBuilder } = require('discord.js');

const COLORS = {
  brand:  0xF4A500, // Eclipse gold
  mute:   0xFFA500, // Orange
  unmute: 0x57F287, // Green
  kick:   0xED4245, // Red
  time:   0x5865F2, // Blurple
};

/**
 * Moderation action log (mute / unmute / kick).
 *
 * @param {{
 *   title: string,
 *   color: number,
 *   target: import('discord.js').GuildMember,
 *   moderator: import('discord.js').GuildMember,
 *   fields?: import('discord.js').APIEmbedField[]
 * }} opts
 */
function modLog({ title, color, target, moderator, fields = [] }) {
  return new EmbedBuilder()
    .setAuthor({
      name: `Action by ${moderator.user.tag}`,
      iconURL: moderator.user.displayAvatarURL(),
    })
    .setTitle(title)
    .setColor(color)
    .setThumbnail(target.user.displayAvatarURL())
    .addFields(
      { name: '👤 Member',    value: `<@${target.id}>`,    inline: true },
      { name: '🛡️ Moderator', value: `<@${moderator.id}>`, inline: true },
      ...fields,
    )
    .setFooter({ text: `Eclipse Bot • User ID: ${target.id}` })
    .setTimestamp();
}

/**
 * Automated action log (e.g. scheduler auto-unmute).
 *
 * @param {{
 *   title: string,
 *   description: string,
 *   color: number,
 *   userId: string
 * }} opts
 */
function autoLog({ title, description, color, userId }) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setFooter({ text: `Eclipse Bot • User ID: ${userId}` })
    .setTimestamp();
}

/**
 * General-purpose informational embed.
 *
 * @param {{
 *   title: string,
 *   description?: string,
 *   fields?: import('discord.js').APIEmbedField[],
 *   color?: number,
 *   thumbnail?: string,
 *   footer?: string
 * }} opts
 */
function info({ title, description, fields = [], color = COLORS.brand, thumbnail, footer = 'Eclipse Bot' }) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setFooter({ text: footer })
    .setTimestamp();

  if (description) embed.setDescription(description);
  if (fields.length) embed.addFields(fields);
  if (thumbnail)    embed.setThumbnail(thumbnail);

  return embed;
}

module.exports = { COLORS, modLog, autoLog, info };
