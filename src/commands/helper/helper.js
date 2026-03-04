const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { getHighestRole } = require('../../utils/checkRole');

const CLAN_INFO = [
  `**Clan:** ${config.clanName} (\`${config.clanTag}\`)`,
  `**Rules:** [Clan Rules](${config.rules})`,
  `**Password:** [Reddit Clan System](${config.password})`,
  `**Subreddit:** [r/RedditEclipse](${config.subreddit})`,
].join('\n');

const ROLE_CONTENT = {
  eclipse: {
    title: 'Eclipse Member Guide',
    description: 'Welcome to Reddit Eclipse! Here is everything you need to get started.',
    fields: [
      { name: 'Clan Info', value: CLAN_INFO },
      {
        name: 'Member Responsibilities',
        value: [
          '• Maintain a healthy donation ratio',
          '• Participate in Clan Wars and Clan Games',
          '• Follow the clan rules at all times',
          '• Stay active or communicate absences',
        ].join('\n'),
      },
    ],
  },

  elder: {
    title: 'Elder Guide',
    description: 'Elder responsibilities and resources.',
    fields: [
      { name: 'Clan Info', value: CLAN_INFO },
      {
        name: 'Elder Responsibilities',
        value: [
          '• Invite new members who meet clan requirements',
          '• Monitor and report donation ratio issues',
          '• Encourage participation in wars and clan games',
          '• Help members with questions and onboarding',
        ].join('\n'),
      },
    ],
  },

  co_leader: {
    title: 'Co-Leader Guide',
    description: 'Co-leader responsibilities and tools.',
    fields: [
      { name: 'Clan Info', value: CLAN_INFO },
      {
        name: 'Elder Responsibilities',
        value: [
          '• Invite new members who meet clan requirements',
          '• Monitor and report donation ratio issues',
          '• Encourage participation in wars and clan games',
        ].join('\n'),
      },
      {
        name: 'Co-Leader Responsibilities',
        value: [
          '• Manage elder promotions and demotions',
          '• Declare wars and manage war rosters',
          '• Enforce clan rules and handle member kicks',
          '• Coordinate with leadership on clan decisions',
          '• Keep leadership channel updated',
        ].join('\n'),
      },
    ],
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('helper')
    .setDescription('Role-based guide for clan members'),

  async execute(interaction) {
    const role = getHighestRole(interaction.member);

    if (!role) {
      return interaction.reply({
        content: 'You need a clan role (Eclipse, Elder, or Co-Leader) to use this command.',
        ephemeral: true,
      });
    }

    const { title, description, fields } = ROLE_CONTENT[role];

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .addFields(fields)
      .setColor(0xF4A500)
      .setFooter({ text: `Reddit Eclipse • ${config.clanTag}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
