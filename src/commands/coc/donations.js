const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const prisma = require('../../lib/prisma');
const cocApi = require('../../services/cocApi');
const { hasRole } = require('../../utils/checkRole');
const Embeds = require('../../utils/embeds');
const { resolveMember } = require('../../utils/prefixParser');
const { getFlairsForUsers } = require('../../utils/flairUtils');
const { formatLeaderboardRow, formatRequesterLine } = require('../../utils/leaderboardUtils');
const {
  getCurrentSeasonKey,
  getFriendInNeedValue,
  formatSeasonKey,
  calcSeasonDonations,
} = require('../../utils/donationUtils');

const ALLOWED_ROLES = ['eclipse', 'hidden_sun', 'co_leader', 'elder'];

/** Returns true if the string looks like a CoC player tag. */
function isCocTag(str) {
  return /^#?[0-9A-Z]{3,12}$/i.test(str.trim());
}

/** Normalises a CoC tag to uppercase with leading #. */
function normaliseTag(raw) {
  const t = raw.trim().toUpperCase();
  return t.startsWith('#') ? t : `#${t}`;
}

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

  if (!snapshot) {
    return interaction.editReply({
      content: `No donation baseline found for **${displayName}** this season. Their account may have been linked after the season started — data will appear next season.`,
    });
  }

  const seasonDonations = calcSeasonDonations(currentValue, snapshot.baselineAchievement);

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

  return interaction.editReply({
    embeds: [
      Embeds.info({
        title:       `Donations — ${player.name}`,
        description: `**${formatSeasonKey(seasonKey)}** (current)\n🎁 **${seasonDonations.toLocaleString()}** donations`,
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

  // Get all snapshots for current season
  const snapshots = await prisma.donationSeasonSnapshot.findMany({
    where: { seasonKey },
  });

  if (snapshots.length === 0) {
    return interaction.editReply({
      content: 'No donation data for this season yet. Members need to `/link` their CoC accounts first.',
    });
  }

  // Find linked Discord users for this guild
  const links = await prisma.playerLink.findMany({
    where: { guildId: guild.id, playerTag: { in: snapshots.map(s => s.playerTag) } },
  });

  const tagToUserId   = new Map(links.map(l => [l.playerTag, l.userId]));
  const tagToBaseline = new Map(snapshots.map(s => [s.playerTag, s.baselineAchievement]));

  // Fetch current achievement values for all players concurrently
  const playerResults = await Promise.allSettled(
    snapshots.map(async s => {
      const player = await cocApi.getPlayer(s.playerTag);
      return {
        playerTag:    s.playerTag,
        playerName:   player.name,
        currentValue: getFriendInNeedValue(player),
      };
    }),
  );

  const entries = playerResults
    .filter(r => r.status === 'fulfilled')
    .map(r => {
      const { playerTag, playerName, currentValue } = r.value;
      const baseline = tagToBaseline.get(playerTag) ?? 0;
      return {
        playerTag,
        playerName,
        userId:    tagToUserId.get(playerTag) ?? null,
        donations: calcSeasonDonations(currentValue, baseline),
      };
    })
    .sort((a, b) => b.donations - a.donations)
    .slice(0, count);

  if (entries.length === 0) {
    return interaction.editReply({ content: 'No donation data available for this season.' });
  }

  // Fetch Discord members + flairs for linked users
  const linkedUserIds = entries.map(e => e.userId).filter(Boolean);
  const [memberMap, flairs] = await Promise.all([
    Promise.all(linkedUserIds.map(id => guild.members.fetch(id).catch(() => null))).then(
      members => new Map(members.filter(Boolean).map(m => [m.id, m])),
    ),
    getFlairsForUsers(linkedUserIds, guild.id),
  ]);

  const maxDonLen = Math.max(...entries.map(e => e.donations.toLocaleString().length));

  const lines = entries.map((e, i) => {
    const statPart = `${e.donations.toLocaleString().padStart(maxDonLen)} donations`;
    const member   = e.userId ? memberMap.get(e.userId) : null;
    const baseName = member?.displayName ?? e.playerName;
    const flair    = e.userId ? flairs.get(e.userId) : null;
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
        .addChoices(
          { name: 'Top 10', value: 10 },
          { name: 'Top 20', value: 20 },
        ),
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
    const targetStr = interaction.options.getString('target');
    const count     = interaction.options.getInteger('count') ?? 10;

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

    // 2. String `target` option — CoC tag, mention, or user ID
    if (targetStr) {
      const trimmed = targetStr.trim();

      // CoC tag (starts with # or looks like one)
      if (isCocTag(trimmed)) {
        const playerTag = normaliseTag(trimmed);
        return replyPlayerDonations(interaction, playerTag, playerTag);
      }

      // Discord mention / user ID / display name
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
    }

    // 3. No target — show leaderboard
    return replyLeaderboard(interaction, count);
  },
};
