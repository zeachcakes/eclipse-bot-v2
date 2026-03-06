const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const prisma = require('../../lib/prisma');
const cocApi = require('../../services/cocApi');
const { ensureCurrentSnapshot } = require('../../services/donationScheduler');
const { hasRole } = require('../../utils/checkRole');
const Embeds = require('../../utils/embeds');
const config = require('../../config');
const { normaliseTag, isValidCocTag } = require('../../utils/donationUtils');

const CLAN_TAGS = new Set([config.clanTag, config.clanTag2]);
const ALLOWED_ROLES = ['eclipse', 'hidden_sun', 'co_leader', 'elder'];

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

    if (!isValidCocTag(playerTag)) {
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
    const existingByTag = await prisma.clanMember.findFirst({
      where: { playerTag, userId: { not: null }, NOT: { userId: interaction.user.id } },
    });
    if (existingByTag) {
      return interaction.editReply({
        content: `\`${playerTag}\` is already linked to another Discord account. Contact a leader if this is incorrect.`,
      });
    }

    // Unlink any other tag this user may have previously linked in this guild
    await prisma.clanMember.updateMany({
      where: { userId: interaction.user.id, guildId: interaction.guild.id, NOT: { playerTag } },
      data:  { userId: null, guildId: null, linkedAt: null },
    });

    // Link the ClanMember record to this Discord user
    await prisma.clanMember.update({
      where: { playerTag },
      data:  { userId: interaction.user.id, guildId: interaction.guild.id, linkedAt: new Date() },
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
