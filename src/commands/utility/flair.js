const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config');
const prisma = require('../../lib/prisma');
const Embeds = require('../../utils/embeds');

const ADMIN_ROLES = ['admin', 'leadership'];

function isAdmin(member) {
  return ADMIN_ROLES.some(key => config.role[key] && member.roles.cache.has(config.role[key]));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('flair')
    .setDescription('Manage emoji flairs shown next to display names')
    // Admin: set flair for any user
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Set a flair for a user (admin only)')
        .addUserOption(opt =>
          opt.setName('user').setDescription('Member to assign flair to').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('emoji').setDescription('Emoji to use as flair').setRequired(true)
        )
    )
    // Admin: remove flair from any user
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a flair from a user (admin only)')
        .addUserOption(opt =>
          opt.setName('user').setDescription('Member to remove flair from').setRequired(true)
        )
    )
    // User: pick from the server's approved pool
    .addSubcommand(sub =>
      sub
        .setName('pick')
        .setDescription('Pick a flair for yourself from the server pool')
        .addStringOption(opt =>
          opt.setName('emoji').setDescription('Emoji from the server pool').setRequired(true)
        )
    )
    // User: clear their own flair
    .addSubcommand(sub =>
      sub.setName('clear').setDescription('Remove your own flair')
    )
    // Everyone: view a user's flair
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription("View a user's flair")
        .addUserOption(opt =>
          opt.setName('user').setDescription('Member to view (defaults to you)').setRequired(false)
        )
    )
    // Admin pool management
    .addSubcommandGroup(group =>
      group
        .setName('pool')
        .setDescription('Manage the server flair pool')
        .addSubcommand(sub =>
          sub
            .setName('add')
            .setDescription('Add an emoji to the server pool (admin only)')
            .addStringOption(opt =>
              opt.setName('emoji').setDescription('Emoji to add').setRequired(true)
            )
            .addStringOption(opt =>
              opt.setName('label').setDescription('Optional display label for this flair').setRequired(false)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('remove')
            .setDescription('Remove an emoji from the server pool (admin only)')
            .addStringOption(opt =>
              opt.setName('emoji').setDescription('Emoji to remove').setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub.setName('list').setDescription('List all available flairs in the server pool')
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const sub   = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);
    const { guild, member } = interaction;

    // ── pool subcommands ──────────────────────────────────────────────────────
    if (group === 'pool') {
      if (sub === 'list') {
        const pool = await prisma.guildFlairPool.findMany({ where: { guildId: guild.id } });
        if (pool.length === 0) {
          return interaction.editReply({
            content: 'No flairs in the server pool yet. Admins can add some with `/flair pool add`.',
          });
        }
        const lines = pool.map(f => f.label ? `${f.emoji}  ${f.label}` : f.emoji);
        return interaction.editReply({
          embeds: [
            Embeds.info({
              title: '✨ Available Flairs',
              description: lines.join('\n'),
            }),
          ],
        });
      }

      if (!isAdmin(member)) {
        return interaction.editReply({
          content: 'You need the Admin or Leadership role to manage the flair pool.',
        });
      }

      if (sub === 'add') {
        const emoji = interaction.options.getString('emoji').trim();
        const label = interaction.options.getString('label')?.trim() ?? null;

        await prisma.guildFlairPool.upsert({
          where:  { guildId_emoji: { guildId: guild.id, emoji } },
          update: { label },
          create: { guildId: guild.id, emoji, label },
        });

        return interaction.editReply({
          content: `Added ${emoji}${label ? ` (${label})` : ''} to the server flair pool.`,
        });
      }

      if (sub === 'remove') {
        const emoji = interaction.options.getString('emoji').trim();

        const deleted = await prisma.guildFlairPool.deleteMany({
          where: { guildId: guild.id, emoji },
        });

        if (deleted.count === 0) {
          return interaction.editReply({
            content: `${emoji} was not found in the server pool.`,
          });
        }

        return interaction.editReply({
          content: `Removed ${emoji} from the server flair pool.`,
        });
      }
    }

    // ── top-level subcommands ─────────────────────────────────────────────────
    if (sub === 'set') {
      if (!isAdmin(member)) {
        return interaction.editReply({
          content: 'You need the Admin or Leadership role to set flairs for other users.',
        });
      }

      const target = interaction.options.getMember('user');
      const emoji  = interaction.options.getString('emoji').trim();

      await prisma.userFlair.upsert({
        where:  { userId_guildId: { userId: target.id, guildId: guild.id } },
        update: { flair: emoji },
        create: { userId: target.id, guildId: guild.id, flair: emoji },
      });

      return interaction.editReply({
        embeds: [
          Embeds.info({
            title:       '🎉 Flair Updated',
            description: `${target.displayName} is now ${emoji}`,
          }),
        ],
      });
    }

    if (sub === 'remove') {
      if (!isAdmin(member)) {
        return interaction.editReply({
          content: 'You need the Admin or Leadership role to remove flairs from other users.',
        });
      }

      const target  = interaction.options.getMember('user');
      const deleted = await prisma.userFlair.deleteMany({
        where: { userId: target.id, guildId: guild.id },
      });

      if (deleted.count === 0) {
        return interaction.editReply({
          content: `${target.displayName} has no flair to remove.`,
        });
      }

      return interaction.editReply({
        content: `Removed flair from ${target.displayName}.`,
      });
    }

    if (sub === 'pick') {
      const emoji = interaction.options.getString('emoji').trim();

      const inPool = await prisma.guildFlairPool.findUnique({
        where: { guildId_emoji: { guildId: guild.id, emoji } },
      });

      if (!inPool) {
        return interaction.editReply({
          content: `${emoji} is not in the server flair pool. Use \`/flair pool list\` to see available options.`,
        });
      }

      await prisma.userFlair.upsert({
        where:  { userId_guildId: { userId: member.id, guildId: guild.id } },
        update: { flair: emoji },
        create: { userId: member.id, guildId: guild.id, flair: emoji },
      });

      return interaction.editReply({
        embeds: [
          Embeds.info({
            title:       '🎉 Flair Updated',
            description: `You are now ${emoji}`,
          }),
        ],
      });
    }

    if (sub === 'clear') {
      const deleted = await prisma.userFlair.deleteMany({
        where: { userId: member.id, guildId: guild.id },
      });

      if (deleted.count === 0) {
        return interaction.editReply({ content: 'You have no flair to clear.' });
      }

      return interaction.editReply({ content: 'Your flair has been removed.' });
    }

    if (sub === 'view') {
      const target = interaction.options.getMember('user') ?? member;

      const record = await prisma.userFlair.findUnique({
        where: { userId_guildId: { userId: target.id, guildId: guild.id } },
      });

      if (!record) {
        const isSelf = target.id === member.id;
        return interaction.editReply({
          content: isSelf
            ? 'You have no flair set. Use `/flair pick` to choose one from the pool.'
            : `${target.displayName} has no flair set.`,
        });
      }

      return interaction.editReply({
        embeds: [
          Embeds.info({
            title:       `${target.displayName}'s Flair`,
            description: record.flair,
          }),
        ],
      });
    }
  },
};
