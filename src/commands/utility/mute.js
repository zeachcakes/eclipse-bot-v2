const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

const ALLOWED_ROLE_KEYS = ['leadership', 'co_leader', 'admin'];

/**
 * Parses a duration string like "10m", "2h", "1d" into milliseconds.
 * Returns null if the format is invalid.
 * @param {string} input
 * @returns {number | null}
 */
function parseDuration(input) {
  const match = input.trim().match(/^(\d+)(m|h|d)$/i);
  if (!match) return null;

  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  const multipliers = { m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * multipliers[unit];
}

/**
 * Formats milliseconds into a human-readable string.
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  return parts.join(' ') || '0m';
}

function isAuthorized(member) {
  return ALLOWED_ROLE_KEYS.some(
    key => config.role[key] && member.roles.cache.has(config.role[key])
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a member for a set duration')
    .addUserOption(option =>
      option.setName('user').setDescription('Member to mute').setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('duration')
        .setDescription('Duration (e.g. 10m, 2h, 1d)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for the mute').setRequired(false)
    ),

  async execute(interaction) {
    // Permission check
    if (!isAuthorized(interaction.member)) {
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    const target = interaction.options.getMember('user');
    const durationInput = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') ?? 'No reason provided.';

    // Validate target
    if (!target) {
      return interaction.reply({ content: 'That user could not be found in this server.', ephemeral: true });
    }

    if (target.id === interaction.user.id) {
      return interaction.reply({ content: 'You cannot mute yourself.', ephemeral: true });
    }

    // Validate duration
    const durationMs = parseDuration(durationInput);
    if (!durationMs) {
      return interaction.reply({
        content: 'Invalid duration format. Use `10m`, `2h`, or `1d`.',
        ephemeral: true,
      });
    }

    // Check muted role is configured
    const mutedRoleId = config.role.muted;
    if (!mutedRoleId) {
      return interaction.reply({ content: 'Muted role is not configured.', ephemeral: true });
    }

    // Pre-flight: bot must have Manage Roles
    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has('ManageRoles')) {
      return interaction.reply({ content: 'I need the **Manage Roles** permission to mute members.', ephemeral: true });
    }

    // Pre-flight: muted role must be below the bot's highest role
    const mutedRole = interaction.guild.roles.cache.get(mutedRoleId);
    if (mutedRole && botMember.roles.highest.position <= mutedRole.position) {
      return interaction.reply({
        content: 'My highest role must be positioned **above** the Muted role in Server Settings → Roles.',
        ephemeral: true,
      });
    }

    // Apply mute
    try {
      await target.roles.add(mutedRoleId, `Muted by ${interaction.user.tag}: ${reason}`);
    } catch (err) {
      console.error('[Mute] Failed to apply muted role:', err);
      return interaction.reply({
        content: 'Failed to apply the muted role. Check my permissions and role hierarchy.',
        ephemeral: true,
      });
    }

    const unmuteAt = new Date(Date.now() + durationMs);
    const durationLabel = formatDuration(durationMs);

    // Confirm to moderator
    await interaction.reply({
      content: `**${target.user.tag}** has been muted for **${durationLabel}**.`,
      ephemeral: true,
    });

    // Log to leader notes channel
    const logChannelId = config.channel.leader_notes;
    try {
      const logChannel = logChannelId
        ? await interaction.client.channels.fetch(logChannelId)
        : null;

      if (logChannel) {
        await logChannel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('Member Muted')
              .setColor(0xFF4500)
              .addFields(
                { name: 'User', value: `${target.user.tag} (<@${target.id}>)`, inline: true },
                { name: 'Moderator', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
                { name: 'Duration', value: durationLabel, inline: true },
                { name: 'Expires', value: `<t:${Math.floor(unmuteAt.getTime() / 1000)}:F>`, inline: true },
                { name: 'Reason', value: reason },
              )
              .setThumbnail(target.user.displayAvatarURL())
              .setFooter({ text: `User ID: ${target.id}` })
              .setTimestamp(),
          ],
        });
      } else {
        console.warn('[Mute] leader_notes channel not found or not configured.');
      }
    } catch (err) {
      console.error('[Mute] Failed to send log:', err);
    }

    // Schedule automatic unmute
    setTimeout(async () => {
      try {
        const refreshed = await interaction.guild.members.fetch(target.id);
        if (refreshed.roles.cache.has(mutedRoleId)) {
          await refreshed.roles.remove(mutedRoleId, 'Mute duration expired');

          try {
            const logChannel = logChannelId
              ? await interaction.client.channels.fetch(logChannelId)
              : null;
            if (logChannel) {
              await logChannel.send({
                embeds: [
                  new EmbedBuilder()
                    .setTitle('Member Unmuted (Auto)')
                    .setColor(0x57F287)
                    .setDescription(`<@${target.id}> has been automatically unmuted.`)
                    .setFooter({ text: `User ID: ${target.id}` })
                    .setTimestamp(),
                ],
              });
            }
          } catch (logErr) {
            console.error('[Mute] Failed to send auto-unmute log:', logErr);
          }
        }
      } catch (err) {
        console.error(`[Mute] Failed to auto-unmute ${target.id}:`, err);
      }
    }, durationMs);
  },
};
