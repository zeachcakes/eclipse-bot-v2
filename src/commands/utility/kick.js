const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const prisma = require('../../lib/prisma');
const Embeds = require('../../utils/embeds');
const { hasRole } = require('../../utils/checkRole');
const { sendModerationLog } = require('../../utils/moderationUtils');

// Roles that may use this command
const ALLOWED_ROLE_KEYS = ['admin', 'co_leader'];

// Roles that cannot be kicked
const PROTECTED_ROLE_KEYS = ['admin', 'leadership', 'co_leader'];

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

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
        flags: MessageFlags.Ephemeral,
      });
    }

    const callerIsAdmin = hasRole(interaction.member, 'admin');

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
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    }

    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') ?? 'No reason provided.';

    if (!target) {
      return interaction.reply({ content: 'That user could not be found in this server.', flags: MessageFlags.Ephemeral });
    }

    if (target.id === interaction.user.id) {
      return interaction.reply({ content: 'You cannot kick yourself.', flags: MessageFlags.Ephemeral });
    }

    // Protected role check
    if (hasRole(target, ...PROTECTED_ROLE_KEYS)) {
      return interaction.reply({
        content: 'That member holds a leadership role and cannot be kicked with this command.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Bot hierarchy check
    if (!target.kickable) {
      return interaction.reply({
        content: 'I cannot kick that member. Check my role position and permissions.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Execute kick
    try {
      await target.kick(`Kicked by ${interaction.user.tag}: ${reason}`);
    } catch (err) {
      console.error('[Kick] Failed to kick member:', err);
      return interaction.reply({
        content: 'Failed to kick that member. Check my permissions.',
        flags: MessageFlags.Ephemeral,
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
      flags: MessageFlags.Ephemeral,
    });

    await sendModerationLog(interaction.client, {
      label: 'Kick',
      title: '👢 Member Kicked',
      color: Embeds.COLORS.kick,
      target,
      moderator: interaction.member,
      fields: [{ name: '📋 Reason', value: reason }],
    });
  },
};
