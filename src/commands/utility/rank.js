const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const prisma = require('../../lib/prisma');
const Embeds = require('../../utils/embeds');
const { getRankForXp, getNextRank, getAllEffectiveRanks, buildProgressBar } = require('../../utils/rankUtils');
const { getUserFlair } = require('../../utils/flairUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription("View your rank or another member's rank")
    .addUserOption(opt =>
      opt.setName('user').setDescription('Member to check (defaults to you)').setRequired(false)
    ),

  async execute(interaction) {
    const target = interaction.options.getMember('user') ?? interaction.member;
    const { guild } = interaction;

    const [record, effectiveRanks, flair] = await Promise.all([
      prisma.userRank.findUnique({
        where: { userId_guildId: { userId: target.id, guildId: guild.id } },
      }),
      getAllEffectiveRanks(guild.id),
      getUserFlair(target.id, guild.id),
    ]);

    const xp          = record?.xp ?? 0;
    const currentRank = getRankForXp(xp);
    const nextRank    = getNextRank(currentRank.level);
    const currentEff  = effectiveRanks.find(r => r.level === currentRank.level);
    const nextEff     = nextRank ? effectiveRanks.find(r => r.level === nextRank.level) : null;

    const fields = [
      { name: '🏅 Rank', value: currentEff.effectiveName, inline: true },
    ];

    if (nextRank) {
      const bar = buildProgressBar(xp, currentRank.threshold, nextRank.threshold);
      fields.push({
        name:  `📈 Progress to ${nextEff.effectiveName}`,
        value: bar,
      });
    } else {
      fields.push({ name: '👑 Status', value: 'Maximum rank achieved — Eclipse Ascendant!' });
    }

    await interaction.reply({
      embeds: [
        Embeds.info({
          title:     `🌌 ${target.displayName}${flair ? ` ${flair}` : ''}'s Rank`,
          color:     currentRank.color,
          thumbnail: target.user.displayAvatarURL(),
          footer:    'Eclipse Bot • Ranking System',
          fields,
        }),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
