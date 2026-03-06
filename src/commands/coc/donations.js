const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const prisma = require('../../lib/prisma');
const cocApi = require('../../services/cocApi');
const config = require('../../config');
const { hasRole } = require('../../utils/checkRole');
const Embeds = require('../../utils/embeds');
const { resolveMember } = require('../../utils/prefixParser');
const { getFlairsForUsers } = require('../../utils/flairUtils');
const { formatLeaderboardRow, formatRequesterLine, resolveLeaderboardOptions } = require('../../utils/leaderboardUtils');
const {
  getCurrentSeasonKey,
  getFriendInNeedValue,
  formatSeasonKey,
  calcSeasonDonations,
  normaliseTag,
  isValidCocTag,
} = require('../../utils/donationUtils');

const ALLOWED_ROLES = ['eclipse', 'hidden_sun', 'co_leader', 'elder'];

// ─── Single-player lookup ─────────────────────────────────────────────────────

async function replyPlayerDonations(interaction, playerTag, displayName) {
  const seasonKey = getCurrentSeasonKey();

  const [player, snapshot] = await Promise.all([
    cocApi.getPlayer(playerTag),
    prisma.donationSeasonSnapshot.findUnique({
      where: { playerTag_seasonKey: { playerTag, seasonKey } },
    }),
  ]);

  const currentValue = getFriendInNeedValue(player);

  let seasonDonations;
  let accuracyNote;

  if (snapshot) {
    const finDelta  = calcSeasonDonations(currentValue, snapshot.baselineAchievement);
    // Max strategy: FiN delta handles cross-hop tracking; in-clan count handles
    // players who linked mid-season after already donating (baseline > actual start).
    seasonDonations = Math.max(finDelta, player.donations ?? 0);
    accuracyNote    = null;
  } else {
    // No baseline — fall back to in-clan count from CoC API
    seasonDonations = player.donations ?? 0;
    accuracyNote    = '-# In-clan only — `/link` for cross-hop tracking';
  }

  // Build recent history (last 3 completed seasons)
  const history = await prisma.donationSeasonSnapshot.findMany({
    where:   { playerTag, finalDonations: { not: null } },
    orderBy: { seasonKey: 'desc' },
    take:    3,
  });

  const historyFields = history.map(h => ({
    name:   formatSeasonKey(h.seasonKey),
    value:  `${h.finalDonations.toLocaleString()} donations`,
    inline: true,
  }));

  const descLines = [
    `**${formatSeasonKey(seasonKey)}** (current)`,
    `🎁 **${seasonDonations.toLocaleString()}** donations`,
  ];
  if (accuracyNote) descLines.push(accuracyNote);

  return interaction.editReply({
    embeds: [
      Embeds.info({
        title:       `Donations — ${player.name}`,
        description: descLines.join('\n'),
        thumbnail:   player.league?.iconUrls?.small ?? null,
        footer:      `${player.tag} • Eclipse Bot`,
        fields:      historyFields.length ? [
          { name: '\u200B', value: '**Past Seasons**', inline: false },
          ...historyFields,
        ] : [],
      }),
    ],
  });
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

async function replyLeaderboard(interaction, count) {
  const seasonKey = getCurrentSeasonKey();
  const { guild }  = interaction;

  // 1. Fetch both clan member lists (2 API calls — includes in-clan donations)
  const [clan1, clan2] = await Promise.all([
    cocApi.getClan(config.clanTag),
    cocApi.getClan(config.clanTag2),
  ]);

  const allMembers = [...(clan1.memberList ?? []), ...(clan2.memberList ?? [])];

  // Deduplicate (a tag should only appear once across both clans)
  const memberMap = new Map();
  for (const m of allMembers) {
    if (!memberMap.has(m.tag)) memberMap.set(m.tag, m);
  }

  if (memberMap.size === 0) {
    return interaction.editReply({ content: 'Could not retrieve clan members from the CoC API.' });
  }

  const allTags = [...memberMap.keys()];

  // 2. Load cached season snapshots + Discord links from DB
  const [snapshots, links] = await Promise.all([
    prisma.donationSeasonSnapshot.findMany({
      where:  { seasonKey, playerTag: { in: allTags } },
      select: { playerTag: true, currentSeasonDonations: true },
    }),
    prisma.playerLink.findMany({
      where:  { guildId: guild.id, playerTag: { in: allTags } },
      select: { playerTag: true, userId: true },
    }),
  ]);

  const tagToSnapshot = new Map(snapshots.map(s => [s.playerTag, s.currentSeasonDonations]));
  const tagToUserId   = new Map(links.map(l => [l.playerTag, l.userId]));

  // 3. Build entries — best available donation count for each member
  const entries = allTags.map(tag => {
    const member            = memberMap.get(tag);
    const snapshotDonations = tagToSnapshot.get(tag) ?? 0;
    const clanDonations     = member.donations ?? 0;
    return {
      playerTag:  tag,
      playerName: member.name,
      userId:     tagToUserId.get(tag) ?? null,
      donations:  Math.max(snapshotDonations, clanDonations),
    };
  });

  entries.sort((a, b) => b.donations - a.donations);
  const top = entries.slice(0, count);

  // 4. Fetch Discord display names + flairs for linked users
  const linkedUserIds = top.map(e => e.userId).filter(Boolean);
  const [memberDiscordMap, flairs] = await Promise.all([
    Promise.all(linkedUserIds.map(id => guild.members.fetch(id).catch(() => null))).then(
      members => new Map(members.filter(Boolean).map(m => [m.id, m])),
    ),
    getFlairsForUsers(linkedUserIds, guild.id),
  ]);

  const maxDonLen = Math.max(...top.map(e => e.donations.toLocaleString().length));

  const lines = top.map((e, i) => {
    const statPart     = `${e.donations.toLocaleString().padStart(maxDonLen)} donations`;
    const discordMember = e.userId ? memberDiscordMap.get(e.userId) : null;
    const baseName      = discordMember?.displayName ?? e.playerName;
    const flair         = e.userId ? flairs.get(e.userId) : null;
    return formatLeaderboardRow(i + 1, statPart, baseName, flair);
  });

  return interaction.editReply({
    embeds: [
      Embeds.info({
        title:       `Donation Leaderboard — ${formatSeasonKey(seasonKey)}`,
        description: `${lines.join('\n')}\n\n**${formatRequesterLine(interaction.member)}**`,
      }),
    ],
  });
}

// ─── Command definition ───────────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('donations')
    .setDescription('View donation stats for the current CoC season')
    .addStringOption(opt =>
      opt
        .setName('target')
        .setDescription('User mention, user ID, or CoC player tag — omit for leaderboard')
        .setRequired(false),
    )
    .addIntegerOption(opt =>
      opt
        .setName('count')
        .setDescription('How many members to show on the leaderboard (default 10)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(50),
    )
    .addUserOption(opt =>
      opt
        .setName('player')
        .setDescription('Pick a Discord member directly (slash only)')
        .setRequired(false),
    ),

  async execute(interaction) {
    if (!hasRole(interaction.member, ...ALLOWED_ROLES)) {
      return interaction.reply({
        content: 'This command is available to **Eclipse** and **The Hidden Sun** members only.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    const memberOpt = interaction.options.getMember('player');
    const { isLeaderboard, target: targetStr, count } = resolveLeaderboardOptions({
      target: interaction.options.getString('target'),
      count:  interaction.options.getInteger('count'),
    });

    // ── Resolve who we're looking up ─────────────────────────────────────────

    // 1. Slash `player` option (Discord user picker)
    if (memberOpt) {
      const link = await prisma.playerLink.findUnique({
        where: { userId_guildId: { userId: memberOpt.id, guildId: interaction.guild.id } },
      });
      if (!link) {
        return interaction.editReply({
          content: `**${memberOpt.displayName}** hasn't linked a CoC account yet. Tell them to use \`/link\`.`,
        });
      }
      return replyPlayerDonations(interaction, link.playerTag, memberOpt.displayName);
    }

    // 2. Leaderboard — no target, bare integer, or `top [N]` alias
    if (isLeaderboard) {
      return replyLeaderboard(interaction, count);
    }

    // 3. String `target` — CoC tag, mention, or user ID
    const trimmed = targetStr.trim();

    if (isValidCocTag(normaliseTag(trimmed))) {
      const playerTag = normaliseTag(trimmed);
      return replyPlayerDonations(interaction, playerTag, playerTag);
    }

    const member = await resolveMember(interaction.guild, trimmed);
    if (member) {
      const link = await prisma.playerLink.findUnique({
        where: { userId_guildId: { userId: member.id, guildId: interaction.guild.id } },
      });
      if (!link) {
        return interaction.editReply({
          content: `**${member.displayName}** hasn't linked a CoC account yet. Tell them to use \`/link\`.`,
        });
      }
      return replyPlayerDonations(interaction, link.playerTag, member.displayName);
    }

    return interaction.editReply({
      content: `Could not resolve \`${targetStr}\` as a Discord member or CoC tag.`,
    });
  },
};
