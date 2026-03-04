const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config');
const prisma = require('../../lib/prisma');
const Embeds = require('../../utils/embeds');

// Roles that may use this command
const ALLOWED_ROLE_KEYS = ['admin', 'co_leader'];

// Roles that cannot be kicked
const PROTECTED_ROLE_KEYS = ['admin', 'leadership', 'co_leader'];

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

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
      const cooldown = await prisma.kickCooldown.findUnique({
        where: { userId_guildId: { userId: interaction.user.id, guildId: interaction.guild.id } },
      });
      if (cooldown) {
        const remaining = COOLDOWN_MS - (Date.now() - cooldown.lastKickAt.getTime());
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

    // Persist kick log and update cooldown for co-leaders
    await prisma.kickLog.create({
      data: {
        userId: target.id,
        guildId: interaction.guild.id,
        moderatorId: interaction.user.id,
        reason,
      },
    });

    if (!callerIsAdmin) {
      await prisma.kickCooldown.upsert({
        where: { userId_guildId: { userId: interaction.user.id, guildId: interaction.guild.id } },
        update: { lastKickAt: new Date() },
        create: { userId: interaction.user.id, guildId: interaction.guild.id, lastKickAt: new Date() },
      });
    }

    await interaction.reply({
      embeds: [
        Embeds.info({
          title: '👢 Member Kicked',
          color: Embeds.COLORS.kick,
          fields: [
            { name: '👤 Member', value: `<@${target.id}>`, inline: true },
            { name: '📋 Reason', value: reason,            inline: true },
          ],
        }),
      ],
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
            Embeds.modLog({
              title: '👢 Member Kicked',
              color: Embeds.COLORS.kick,
              target,
              moderator: interaction.member,
              fields: [
                { name: '📋 Reason', value: reason },
              ],
            }),
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
