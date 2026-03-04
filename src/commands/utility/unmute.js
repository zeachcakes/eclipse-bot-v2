const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const prisma = require('../../lib/prisma');

const ALLOWED_ROLE_KEYS = ['leadership', 'co_leader', 'admin'];

function isAuthorized(member) {
  return ALLOWED_ROLE_KEYS.some(
    key => config.role[key] && member.roles.cache.has(config.role[key])
  );
}

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
    if (!isAuthorized(interaction.member)) {
      return interaction.reply({
        content: 'You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') ?? 'No reason provided.';

    if (!target) {
      return interaction.reply({ content: 'That user could not be found in this server.', ephemeral: true });
    }

    const mutedRoleId = config.role.muted;
    if (!mutedRoleId) {
      return interaction.reply({ content: 'Muted role is not configured.', ephemeral: true });
    }

    if (!target.roles.cache.has(mutedRoleId)) {
      return interaction.reply({ content: 'That member is not muted.', ephemeral: true });
    }

    try {
      await target.roles.remove(mutedRoleId, `Unmuted by ${interaction.user.tag}: ${reason}`);
    } catch (err) {
      console.error('[Unmute] Failed to remove muted role:', err);
      return interaction.reply({
        content: 'Failed to remove the muted role. Check my permissions and role hierarchy.',
        ephemeral: true,
      });
    }

    // Deactivate any active DB mute records for this user
    await prisma.mute.updateMany({
      where: { userId: target.id, guildId: interaction.guild.id, active: true },
      data: { active: false },
    });

    await interaction.reply({
      content: `**${target.user.tag}** has been unmuted.`,
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
              .setTitle('Member Unmuted')
              .setColor(0x57F287)
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
        console.warn('[Unmute] leader_notes channel not found or not configured.');
      }
    } catch (err) {
      console.error('[Unmute] Failed to send log:', err);
    }
  },
};
