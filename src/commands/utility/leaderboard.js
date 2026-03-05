const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const prisma = require('../../lib/prisma');
const Embeds = require('../../utils/embeds');
const { getRankForXp, getAllEffectiveRanks } = require('../../utils/rankUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the top 10 members by message count'),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { guild } = interaction;

    const [top10, effectiveRanks] = await Promise.all([
      prisma.userRank.findMany({
        where:   { guildId: guild.id },
        orderBy: { xp: 'desc' },
        take:    10,
      }),
      getAllEffectiveRanks(guild.id),
    ]);

    if (top10.length === 0) {
      return interaction.editReply({ content: 'No ranking data yet — start chatting!' });
    }

    // Fetch all members in one batch where possible
    const members = await Promise.all(
      top10.map(r => guild.members.fetch(r.userId).catch(() => null))
    );

    const lines = top10.map((record, i) => {
      const rank      = getRankForXp(record.xp);
      const effective = effectiveRanks.find(r => r.level === rank.level);
      const name      = members[i]?.displayName ?? 'Unknown User';

      const pos      = String(i + 1).padStart(2);
      const xpStr    = record.xp.toLocaleString('en-US').padStart(7);
      const rankPart = `(${effective.effectiveName})`.padEnd(21);

      return `${pos}  ${xpStr} xp  ${rankPart}  |  ${name}`;
    });

    const now      = new Date();
    const dateStr  = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
    const timeStr  = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' });
    const reqLine  = `Requested by ${interaction.member.displayName} on ${dateStr} at ${timeStr} EST`;

    await interaction.editReply({
      embeds: [
        Embeds.info({
          title:       '🏆 Top Members by Messages',
          description: `\`\`\`\n${lines.join('\n')}\n\`\`\`\n**${reqLine}**`,
        }),
      ],
    });
  },
};
