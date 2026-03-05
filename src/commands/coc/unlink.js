const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const prisma = require('../../lib/prisma');
const { hasRole } = require('../../utils/checkRole');
const Embeds = require('../../utils/embeds');

const ALLOWED_ROLES = ['eclipse', 'hidden_sun', 'co_leader', 'elder'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink your Clash of Clans account from your Discord profile'),

  async execute(interaction) {
    if (!hasRole(interaction.member, ...ALLOWED_ROLES)) {
      return interaction.reply({
        content: 'This command is available to **Eclipse** and **The Hidden Sun** members only.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const existing = await prisma.playerLink.findUnique({
      where: { userId_guildId: { userId: interaction.user.id, guildId: interaction.guild.id } },
    });

    if (!existing) {
      return interaction.reply({
        content: "You don't have a CoC account linked. Use `/link` to link one.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await prisma.playerLink.delete({
      where: { userId_guildId: { userId: interaction.user.id, guildId: interaction.guild.id } },
    });

    return interaction.reply({
      embeds: [
        Embeds.info({
          title:       'Account Unlinked',
          description: `Your CoC account (\`${existing.playerTag}\`) has been unlinked from your Discord profile.\nSeason history is preserved — use \`/link\` to re-link at any time.`,
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
