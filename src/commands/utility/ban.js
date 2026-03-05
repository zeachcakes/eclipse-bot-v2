const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config');
const prisma = require('../../lib/prisma');
const Embeds = require('../../utils/embeds');

const BAN_GIF_URL = 'https://tenor.com/bxLSs.gif';

// Roles that may execute a ban
const ALLOWED_ROLE_KEYS = ['admin', 'co_leader'];

// Roles that cannot be banned
const PROTECTED_ROLE_KEYS = ['admin', 'leadership', 'co_leader'];

function hasRole(member, ...keys) {
  return keys.some(key => config.role[key] && member.roles.cache.has(config.role[key]));
}

function isAdmin(member) {
  return !!(config.role.admin && member.roles.cache.has(config.role.admin));
}

async function getGifMode(guildId) {
  const setting = await prisma.guildSetting.findUnique({ where: { guildId } });
  return setting?.banGifMode ?? true;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member or manage ban mode')
    .addSubcommand(sub =>
      sub
        .setName('user')
        .setDescription('Ban a member from the server')
        .addUserOption(option =>
          option.setName('user').setDescription('Member to ban').setRequired(true)
        )
        .addStringOption(option =>
          option.setName('reason').setDescription('Reason for the ban').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('toggle')
        .setDescription('Toggle between gif mode and real ban mode (admin only)')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'toggle') {
      if (!isAdmin(interaction.member)) {
        return interaction.reply({
          content: 'Only admins can toggle ban mode.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const current = await getGifMode(interaction.guild.id);
      const next = !current;

      await prisma.guildSetting.upsert({
        where: { guildId: interaction.guild.id },
        update: { banGifMode: next },
        create: { guildId: interaction.guild.id, banGifMode: next },
      });

      // next=false means real bans on (Enabled), next=true means gif mode (Disabled)
      return interaction.reply({
        embeds: [
          Embeds.info({
            title: next ? '🔨 Ban: Disabled' : '🔨 Ban: Enabled',
            color: next ? Embeds.COLORS.brand : Embeds.COLORS.ban,
          }),
        ],
      });
    }

    // sub === 'user'
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

    if (target.id === interaction.user.id) {
      return interaction.reply({ content: 'You cannot ban yourself.', flags: MessageFlags.Ephemeral });
    }

    if (hasRole(target, ...PROTECTED_ROLE_KEYS)) {
      return interaction.reply({
        content: 'That member holds a leadership role and cannot be banned with this command.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const gifMode = await getGifMode(interaction.guild.id);

    if (gifMode) {
      return interaction.reply({
        content: `**${target.user.username} flew too close to the sun!**\n${BAN_GIF_URL}`,
      });
    }

    // Real ban
    if (!target.bannable) {
      return interaction.reply({
        content: 'I cannot ban that member. Check my role position and permissions.',
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      await target.ban({ reason: `Banned by ${interaction.user.tag}: ${reason}` });
    } catch (err) {
      console.error('[Ban] Failed to ban member:', err);
      return interaction.reply({
        content: 'Failed to ban that member. Check my permissions.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await prisma.banLog.create({
      data: {
        userId: target.id,
        guildId: interaction.guild.id,
        moderatorId: interaction.user.id,
        reason,
      },
    });

    await interaction.reply({
      embeds: [
        Embeds.info({
          title: '🔨 Member Banned',
          color: Embeds.COLORS.ban,
          fields: [
            { name: '👤 Member', value: `<@${target.id}>`, inline: true },
            { name: '📋 Reason', value: reason,            inline: true },
          ],
        }),
      ],
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
              title: '🔨 Member Banned',
              color: Embeds.COLORS.ban,
              target,
              moderator: interaction.member,
              fields: [
                { name: '📋 Reason', value: reason },
              ],
            }),
          ],
        });
      } else {
        console.warn('[Ban] leader_notes channel not found or not configured.');
      }
    } catch (err) {
      console.error('[Ban] Failed to send log:', err);
    }
  },
};
