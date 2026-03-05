const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config');
const prisma = require('../../lib/prisma');
const { RANKS } = require('../../config/ranks');

const ADMIN_ROLES = ['admin', 'leadership'];

function isAdmin(member) {
  return ADMIN_ROLES.some(key => config.role[key] && member.roles.cache.has(config.role[key]));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ranks')
    .setDescription('Manage server rank names')
    .setDefaultMemberPermissions(0)
    .addSubcommand(sub =>
      sub
        .setName('setname')
        .setDescription('Override a rank name for this server (admin only)')
        .addIntegerOption(opt =>
          opt
            .setName('level')
            .setDescription('Rank level to rename (1–8)')
            .setMinValue(1)
            .setMaxValue(8)
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('name').setDescription('New name for this rank').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('resetname')
        .setDescription('Reset a rank name back to the default (admin only)')
        .addIntegerOption(opt =>
          opt
            .setName('level')
            .setDescription('Rank level to reset (1–8)')
            .setMinValue(1)
            .setMaxValue(8)
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const sub     = interaction.options.getSubcommand();
    const { guild } = interaction;

    // All subcommands are admin-only
    if (!isAdmin(interaction.member)) {
      return interaction.reply({
        content: 'You need the Admin or Leadership role to manage rank names.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const level = interaction.options.getInteger('level');

    if (sub === 'setname') {
      const name = interaction.options.getString('name').trim();

      await prisma.guildRankConfig.upsert({
        where:  { guildId_rankLevel: { guildId: guild.id, rankLevel: level } },
        update: { name },
        create: { guildId: guild.id, rankLevel: level, name },
      });

      return interaction.reply({
        content: `Rank **${level}** renamed to **${name}** for this server.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sub === 'resetname') {
      await prisma.guildRankConfig.deleteMany({
        where: { guildId: guild.id, rankLevel: level },
      });

      const defaultName = RANKS.find(r => r.level === level)?.name;
      return interaction.reply({
        content: `Rank **${level}** reset to default: **${defaultName}**.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
