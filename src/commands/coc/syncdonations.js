const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { hasRole } = require('../../utils/checkRole');
const { rolloverIfNeeded } = require('../../services/donationScheduler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('syncdonations')
    .setDescription('Manually refresh donation snapshots for all linked players (admin only)'),

  async execute(interaction) {
    if (!hasRole(interaction.member, 'admin')) {
      return interaction.reply({
        content: 'This command is restricted to **admins** only.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { rolledOver, refreshed } = await rolloverIfNeeded();

    const total = rolledOver + refreshed;
    const parts = [];
    if (rolledOver > 0) parts.push(`${rolledOver} rolled over to new season`);
    if (refreshed  > 0) parts.push(`${refreshed} refreshed mid-season`);

    const detail = parts.length ? ` (${parts.join(', ')})` : '';

    return interaction.editReply({
      content: total === 0
        ? 'No linked players found — nothing to sync.'
        : `Sync complete — updated **${total}** player(s)${detail}.`,
    });
  },
};
