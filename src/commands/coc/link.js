const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const prisma = require('../../lib/prisma');
const cocApi = require('../../services/cocApi');
const { ensureCurrentSnapshot } = require('../../services/donationScheduler');
const { hasRole } = require('../../utils/checkRole');
const Embeds = require('../../utils/embeds');
const config = require('../../config');

const CLAN_TAGS = new Set([config.clanTag, config.clanTag2]);
const ALLOWED_ROLES = ['eclipse', 'hidden_sun', 'co_leader', 'elder'];

/** Normalises a CoC tag — ensures it starts with # and is uppercase. */
function normaliseTag(raw) {
  const trimmed = raw.trim().toUpperCase();
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

/** Basic format check: # followed by 3–12 alphanumeric chars. */
function isValidTagFormat(tag) {
  return /^#[0-9A-Z]{3,12}$/.test(tag);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your Clash of Clans account to your Discord profile')
    .addStringOption(opt =>
      opt
        .setName('player_tag')
        .setDescription('Your CoC player tag (e.g. #ABC123)')
        .setRequired(true),
    ),

  async execute(interaction) {
    if (!hasRole(interaction.member, ...ALLOWED_ROLES)) {
      return interaction.reply({
        content: 'This command is available to **Eclipse** and **The Hidden Sun** members only.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const rawTag    = interaction.options.getString('player_tag');
    const playerTag = normaliseTag(rawTag);

    if (!isValidTagFormat(playerTag)) {
      return interaction.reply({
        content: `\`${rawTag}\` doesn't look like a valid CoC tag. Use the format \`#ABC123\`.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Verify the player exists in the CoC API
    let player;
    try {
      player = await cocApi.getPlayer(playerTag);
    } catch {
      return interaction.editReply({
        content: `Could not find a player with tag \`${playerTag}\`. Double-check the tag and try again.`,
      });
    }

    // Verify the player is currently in one of the two clans
    const clanTag = player.clan?.tag;
    if (!clanTag || !CLAN_TAGS.has(clanTag)) {
      return interaction.editReply({
        content: [
          `**${player.name}** (\`${playerTag}\`) is not currently in **${config.clanName}** or **${config.clan2Name}**.`,
          'You must be an active member of one of those clans to link your account.',
        ].join('\n'),
      });
    }

    // Check if this tag is already linked by someone else
    const existingByTag = await prisma.playerLink.findFirst({
      where: { playerTag, NOT: { userId: interaction.user.id } },
    });
    if (existingByTag) {
      return interaction.editReply({
        content: `\`${playerTag}\` is already linked to another Discord account. Contact a leader if this is incorrect.`,
      });
    }

    // Upsert the link (handles re-linking after an unlink)
    await prisma.playerLink.upsert({
      where:  { userId_guildId: { userId: interaction.user.id, guildId: interaction.guild.id } },
      update: { playerTag },
      create: { userId: interaction.user.id, guildId: interaction.guild.id, playerTag },
    });

    // Ensure a donation baseline exists for the current season
    await ensureCurrentSnapshot(playerTag);

    await interaction.editReply({
      embeds: [
        Embeds.info({
          title:       'Account Linked',
          description: `Successfully linked **${player.name}** (\`${playerTag}\`) to your Discord profile.`,
          footer:      `Eclipse Bot • ${player.clan?.name ?? 'Unknown Clan'}`,
        }),
      ],
    });
  },
};
