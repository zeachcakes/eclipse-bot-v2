const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');

// Roles that may use this command
const ALLOWED_ROLE_KEYS = ['admin', 'co_leader'];

// Roles that cannot be kicked
const PROTECTED_ROLE_KEYS = ['admin', 'leadership', 'co_leader'];

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

// Map<userId, lastKickTimestamp>
const cooldowns = new Map();

function hasRole(member, ...keys) {
  return keys.some(key => config.role[key] && member.roles.cache.has(config.role[key]));
}

function isAdmin(member) {
  return !!(config.role.admin && member.roles.cache.has(config.role.admin));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption(option =>
      option.setName('user').setDescription('Member to kick').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for the kick').setRequired(false)
    ),

  async execute(interaction) {
    // Permission check
    if (!hasRole(interaction.member, ...ALLOWED_ROLE_KEYS)) {
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    const callerIsAdmin = isAdmin(interaction.member);

    // Cooldown check (co-leaders only)
    if (!callerIsAdmin) {
      const lastKick = cooldowns.get(interaction.user.id);
      if (lastKick) {
        const remaining = COOLDOWN_MS - (Date.now() - lastKick);
        if (remaining > 0) {
          const minutes = Math.ceil(remaining / 60_000);
          return interaction.reply({
            content: `You are on cooldown. You can kick again in **${minutes} minute${minutes !== 1 ? 's' : ''}**.`,
            ephemeral: true,
          });
        }
      }
    }

    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') ?? 'No reason provided.';

    if (!target) {
      return interaction.reply({ content: 'That user could not be found in this server.', ephemeral: true });
    }

    if (target.id === interaction.user.id) {
      return interaction.reply({ content: 'You cannot kick yourself.', ephemeral: true });
    }

    // Protected role check
    if (hasRole(target, ...PROTECTED_ROLE_KEYS)) {
      return interaction.reply({
        content: 'That member holds a leadership role and cannot be kicked with this command.',
        ephemeral: true,
      });
    }

    // Bot hierarchy check
    if (!target.kickable) {
      return interaction.reply({
        content: 'I cannot kick that member. Check my role position and permissions.',
        ephemeral: true,
      });
    }

    // Execute kick
    try {
      await target.kick(`Kicked by ${interaction.user.tag}: ${reason}`);
    } catch (err) {
      console.error('[Kick] Failed to kick member:', err);
      return interaction.reply({
        content: 'Failed to kick that member. Check my permissions.',
        ephemeral: true,
      });
    }

    // Set cooldown for co-leaders
    if (!callerIsAdmin) {
      cooldowns.set(interaction.user.id, Date.now());
    }

    await interaction.reply({
      content: `**${target.user.tag}** has been kicked.`,
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
              .setTitle('Member Kicked')
              .setColor(0xE74C3C)
              .addFields(
                { name: 'User', value: `${target.user.tag} (<@${target.id}>)`, inline: true },
                { name: 'Moderator', value: `${interaction.user.tag} (<@${interaction.user.id}>)`, inline: true },
                { name: 'Reason', value: reason },
              )
              .setThumbnail(target.user.displayAvatarURL())
              .setFooter({ text: `User ID: ${target.id}` })
              .setTimestamp(),
          ],
        });
      } else {
        console.warn('[Kick] leader_notes channel not found or not configured.');
      }
    } catch (err) {
      console.error('[Kick] Failed to send log:', err);
    }
  },
};
