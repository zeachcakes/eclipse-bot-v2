const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config');
const prisma = require('../../lib/prisma');
const Embeds = require('../../utils/embeds');
const { hasRole } = require('../../utils/checkRole');
const { sendModerationLog } = require('../../utils/moderationUtils');

const ALLOWED_ROLE_KEYS = ['leadership', 'co_leader', 'admin'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmute a member')
    .addUserOption(option =>
      option.setName('user').setDescription('Member to unmute').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for the unmute').setRequired(false)
    ),

  async execute(interaction) {
    if (!hasRole(interaction.member, ...ALLOWED_ROLE_KEYS)) {
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') ?? 'No reason provided.';

    if (!target) {
      return interaction.reply({ content: 'That user could not be found in this server.', flags: MessageFlags.Ephemeral });
    }

    const mutedRoleId = config.role.muted;
    if (!mutedRoleId) {
      return interaction.reply({ content: 'Muted role is not configured.', flags: MessageFlags.Ephemeral });
    }

    if (!target.roles.cache.has(mutedRoleId)) {
      return interaction.reply({ content: 'That member is not muted.', flags: MessageFlags.Ephemeral });
    }

    try {
      await target.roles.remove(mutedRoleId, `Unmuted by ${interaction.user.tag}: ${reason}`);
    } catch (err) {
      console.error('[Unmute] Failed to remove muted role:', err);
      return interaction.reply({
        content: 'Failed to remove the muted role. Check my permissions and role hierarchy.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Ensure moderator has a GuildMember record (required by FK on future mute logs)
    await prisma.guildMember.upsert({
      where:  { userId_guildId: { userId: interaction.user.id, guildId: interaction.guild.id } },
      update: {},
      create: { userId: interaction.user.id, guildId: interaction.guild.id },
    });

    // Deactivate any active DB mute records for this user
    await prisma.mute.updateMany({
      where: { userId: target.id, guildId: interaction.guild.id, active: true },
      data: { active: false },
    });

    await interaction.reply({
      embeds: [
        Embeds.info({
          title: '🔊 Member Unmuted',
          color: Embeds.COLORS.unmute,
          fields: [
            { name: '👤 Member', value: `<@${target.id}>`, inline: true },
            { name: '📋 Reason', value: reason,            inline: true },
          ],
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });

    await sendModerationLog(interaction.client, {
      label: 'Unmute',
      title: '🔊 Member Unmuted',
      color: Embeds.COLORS.unmute,
      target,
      moderator: interaction.member,
      fields: [{ name: '📋 Reason', value: reason }],
    });
  },
};
