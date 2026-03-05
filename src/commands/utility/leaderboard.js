const { SlashCommandBuilder } = require('discord.js');
const prisma = require('../../lib/prisma');
const Embeds = require('../../utils/embeds');
const { getRankForXp, getAllEffectiveRanks } = require('../../utils/rankUtils');
const { getFlairsForUsers } = require('../../utils/flairUtils');

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function formatXp(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View server leaderboards')
    .addStringOption(opt =>
      opt
        .setName('sort')
        .setDescription('What to rank by (default: XP)')
        .addChoices(
          { name: 'XP',               value: 'xp' },
          { name: 'Account Age',      value: 'account_age' },
          { name: 'Server Join Date', value: 'join_date' },
        )
        .setRequired(false)
    )
    .addIntegerOption(opt =>
      opt
        .setName('count')
        .setDescription('How many members to show (default: 10)')
        .addChoices(
          { name: 'Top 10', value: 10 },
          { name: 'Top 20', value: 20 },
        )
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const { guild } = interaction;
    const sort  = interaction.options.getString('sort')   ?? 'xp';
    const count = interaction.options.getInteger('count') ?? 10;

    const now     = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' });
    const reqLine = `Requested by ${interaction.member.displayName} on ${dateStr} at ${timeStr} EST`;

    // ── XP leaderboard ────────────────────────────────────────────────────────
    if (sort === 'xp') {
      const [topRecords, effectiveRanks] = await Promise.all([
        prisma.userRank.findMany({
          where:   { guildId: guild.id },
          orderBy: { xp: 'desc' },
          take:    count,
        }),
        getAllEffectiveRanks(guild.id),
      ]);

      if (topRecords.length === 0) {
        return interaction.editReply({ content: 'No ranking data yet — start chatting!' });
      }

      const [members, flairs] = await Promise.all([
        Promise.all(topRecords.map(r => guild.members.fetch(r.userId).catch(() => null))),
        getFlairsForUsers(topRecords.map(r => r.userId), guild.id),
      ]);

      // Rank column width based on ALL possible rank names for consistent alignment
      const maxRankLen = Math.max(...effectiveRanks.map(r => `(${r.effectiveName})`.length));

      const rows = topRecords.map((record, i) => {
        const rank      = getRankForXp(record.xp);
        const effective = effectiveRanks.find(r => r.level === rank.level);
        return {
          pos:      String(i + 1).padStart(2),
          xpStr:    formatXp(record.xp).padStart(6),
          rankPart: `(${effective.effectiveName})`.padEnd(maxRankLen),
          baseName: members[i]?.displayName ?? 'Unknown User',
          flair:    flairs.get(record.userId),
        };
      });

      const lines = rows.map(r => {
        const stats = `\`${r.pos}  ${r.xpStr} xp  ${r.rankPart} |\``;
        const name  = r.flair ? `${r.flair} ${r.baseName}` : r.baseName;
        return `${stats}  ${name}`;
      });

      return interaction.editReply({
        embeds: [
          Embeds.info({
            title:       `🏆 Top ${topRecords.length} Members by XP`,
            description: `${lines.join('\n')}\n\n**${reqLine}**`,
          }),
        ],
      });
    }

    // ── Account age / join date leaderboards ──────────────────────────────────
    await guild.members.fetch(); // cache all members
    const allMembers = [...guild.members.cache.values()].filter(m => !m.user.bot);

    if (sort === 'account_age') {
      allMembers.sort((a, b) => a.user.createdTimestamp - b.user.createdTimestamp);
    } else {
      allMembers.sort((a, b) => (a.joinedTimestamp ?? 0) - (b.joinedTimestamp ?? 0));
    }

    const top    = allMembers.slice(0, count);
    const flairs = await getFlairsForUsers(top.map(m => m.id), guild.id);

    const lines = top.map((m, i) => {
      const flair    = flairs.get(m.id);
      const baseName = m.displayName;
      const name     = flair ? `${flair} ${baseName}` : baseName;
      const date     = sort === 'account_age'
        ? formatDate(m.user.createdAt)
        : formatDate(m.joinedAt ?? new Date(0));

      return `**${i + 1}.** ${name} — ${date}`;
    });

    const title = sort === 'account_age'
      ? `🗓️ Top ${top.length} Oldest Discord Accounts`
      : `📅 Top ${top.length} Longest Server Members`;

    return interaction.editReply({
      embeds: [
        Embeds.info({
          title,
          description: `${lines.join('\n')}\n\n**${reqLine}**`,
        }),
      ],
    });
  },
};
