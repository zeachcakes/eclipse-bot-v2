const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const cocApi = require('../../services/cocApi');
const config = require('../../config');
const { hasRole } = require('../../utils/checkRole');

const LEADERSHIP_ROLES = ['co_leader', 'elder'];

const WAR_FREQUENCY = {
  always: 'Always',
  moreThanOncePerWeek: 'More than once per week',
  oncePerWeek: 'Once per week',
  lessThanOncePerWeek: 'Less than once per week',
  never: 'Never',
  unknown: 'Unknown',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clan')
    .setDescription('Fetch current clan data from the Clash of Clans API'),

  async execute(interaction) {
    if (!hasRole(interaction.member, ...LEADERSHIP_ROLES)) {
      return interaction.reply({
        content: 'This command is restricted to **Elders** and **Co-Leaders**.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const clan = await cocApi.getClan(config.clanTag);

    const embed = new EmbedBuilder()
      .setTitle(`${clan.name} (${clan.tag})`)
      .setThumbnail(clan.badgeUrls?.medium ?? null)
      .setColor(0xF4A500)
      .addFields(
        { name: 'Clan Level', value: `${clan.clanLevel}`, inline: true },
        { name: 'Members', value: `${clan.members}/50`, inline: true },
        { name: 'Type', value: clan.type ?? 'N/A', inline: true },
        { name: 'War League', value: clan.warLeague?.name ?? 'Unranked', inline: true },
        { name: 'War Wins', value: `${clan.warWins ?? 0}`, inline: true },
        { name: 'Win Streak', value: `${clan.warWinStreak ?? 0}`, inline: true },
        { name: 'War Frequency', value: WAR_FREQUENCY[clan.warFrequency] ?? clan.warFrequency ?? 'N/A', inline: true },
        { name: 'Required Trophies', value: `${clan.requiredTrophies ?? 0}`, inline: true },
        { name: 'Points', value: `${clan.clanPoints ?? 0}`, inline: true },
      )
      .setFooter({ text: `Reddit Eclipse • ${config.clanTag}` })
      .setTimestamp();

    if (clan.description) {
      embed.setDescription(clan.description);
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
