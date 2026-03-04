const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');
const Embeds = require('../../utils/embeds');

const LEADERSHIP_ROLES = ['admin', 'co_leader', 'leadership'];
const CLAN_ROLES       = ['eclipse', 'elder', 'co_leader', 'admin', 'leadership'];

function hasAnyRole(member, roleKeys) {
  return roleKeys.some(key => config.role[key] && member.roles.cache.has(config.role[key]));
}

const ALL_CATEGORIES = [
  {
    id:   'misc',
    name: '⚙️ Misc',
    tier: 'public',
    commands: [
      { name: '/ping',   description: 'Check bot latency' },
      { name: '/invite', description: 'Get the Reddit Eclipse Discord invite link' },
    ],
  },
  {
    id:   'help',
    name: '❓ Help',
    tier: 'public',
    commands: [
      { name: '/help', description: 'List all available commands' },
    ],
  },
  {
    id:   'clan',
    name: '🏰 Clan',
    tier: 'clan',
    commands: [
      { name: '/time now',     description: 'Show the current clan time (Eastern)' },
      { name: '/time convert', description: 'Convert a time between timezones' },
      { name: '/helper',       description: 'Role-based guide for clan members' },
      { name: '/clan',         description: 'Fetch current clan data from the CoC API' },
    ],
  },
  {
    id:   'leadership',
    name: '👑 Leadership',
    tier: 'leadership',
    commands: [
      { name: '/kick',   description: 'Kick a member from the server' },
      { name: '/mute',   description: 'Mute a member for a set duration' },
      { name: '/unmute', description: 'Unmute a member' },
    ],
  },
];

function buildOverviewEmbed(pages) {
  return Embeds.info({
    title:       '📖 Eclipse Bot — Commands',
    description: pages
      .map(cat => `${cat.name} — ${cat.commands.length} command${cat.commands.length !== 1 ? 's' : ''}`)
      .join('\n'),
    footer: 'Select a category below',
  });
}

function buildCategoryEmbed(cat) {
  return Embeds.info({
    title:       `📖 ${cat.name}`,
    description: cat.commands.map(c => `\`${c.name}\` — ${c.description}`).join('\n'),
    footer:      'Use / to invoke any command • ← Back to return',
  });
}

// Returns an array of ActionRows (max 5 buttons per row)
function buildCategoryRows(pages) {
  const buttons = pages.map(cat =>
    new ButtonBuilder()
      .setCustomId(`help_cat_${cat.id}`)
      .setLabel(cat.name)
      .setStyle(ButtonStyle.Primary)
  );

  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }
  return rows;
}

const BACK_ROW = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('help_back')
    .setLabel('← Back')
    .setStyle(ButtonStyle.Secondary)
);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all available commands'),

  async execute(interaction) {
    const { member } = interaction;
    const isLeadership = hasAnyRole(member, LEADERSHIP_ROLES);
    const isClan       = hasAnyRole(member, CLAN_ROLES);

    const pages = ALL_CATEGORIES.filter(cat => {
      if (cat.tier === 'leadership') return isLeadership;
      if (cat.tier === 'clan')       return isClan;
      return true;
    });

    const message = await interaction.reply({
      embeds:     [buildOverviewEmbed(pages)],
      components: buildCategoryRows(pages),
      ephemeral:  true,
      fetchReply: true,
    });

    const collector = message.createMessageComponentCollector({
      filter: i => i.user.id === interaction.user.id,
      time:   5 * 60 * 1000, // 5 minutes
    });

    collector.on('collect', async i => {
      if (i.customId === 'help_back') {
        return i.update({
          embeds:     [buildOverviewEmbed(pages)],
          components: buildCategoryRows(pages),
        });
      }

      const cat = pages.find(p => `help_cat_${p.id}` === i.customId);
      if (!cat) return;

      await i.update({
        embeds:     [buildCategoryEmbed(cat)],
        components: [BACK_ROW],
      });
    });

    // Remove buttons when the collector times out
    collector.on('end', () => {
      interaction.editReply({ components: [] }).catch(() => null);
    });
  },
};
