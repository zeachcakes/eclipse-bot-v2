const { Events } = require('discord.js');
const prisma = require('../lib/prisma');
const Embeds = require('../utils/embeds');
const { RANKS } = require('../config/ranks');
const { getRankForXp, getNextRank, getAllEffectiveRanks } = require('../utils/rankUtils');
const { getUserFlair } = require('../utils/flairUtils');
const { parseArgs, tokenize, buildUsage } = require('../utils/prefixParser');
const { CommandContext } = require('../utils/CommandContext');
const config = require('../config');

const XP_PER_MESSAGE = 20;

/**
 * Removes any rank roles the member currently holds.
 * Checks both default names and any custom server overrides to handle renames correctly.
 */
async function removeAllRankRoles(member, effectiveRanks) {
  const allRankNames = new Set([
    ...RANKS.map(r => r.name),
    ...effectiveRanks.map(r => r.effectiveName),
  ]);

  const toRemove = member.roles.cache.filter(r => allRankNames.has(r.name));
  if (toRemove.size > 0) {
    await member.roles.remove([...toRemove.keys()]).catch(() => null);
  }
}

/**
 * Finds the rank role by name in the guild, creating it if it doesn't exist yet.
 */
async function getOrCreateRankRole(guild, rank, effectiveName) {
  let role = guild.roles.cache.find(r => r.name === effectiveName);
  if (!role) {
    role = await guild.roles.create({
      name:   effectiveName,
      colors: rank.color,
      reason: 'Eclipse Bot — rank role auto-created',
    });
  }
  return role;
}

module.exports = {
  name: Events.MessageCreate,

  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild)     return;

    // ── Prefix command handling ────────────────────────────────────────────────
    if (message.content.startsWith(config.prefix)) {
      const args        = tokenize(message.content.slice(config.prefix.length));
      if (args.length === 0) return;

      const commandName = args.shift().toLowerCase();
      const command     = message.client.commands.get(commandName);

      if (!command) return; // Unknown command — silently ignore

      // If the command uses subcommands and none was provided, show usage
      const schema     = command.data.toJSON();
      const topOptions = schema.options ?? [];
      const hasSubcmds = topOptions.some(o => o.type === 1 /* SUB_COMMAND */ || o.type === 2 /* SUB_COMMAND_GROUP */);

      try {
        const optionsResolver = await parseArgs(message, command.data, args);

        if (hasSubcmds && !optionsResolver.getSubcommand()) {
          await message.channel.send({
            content: `**Usage:**\n${buildUsage(config.prefix, schema)}`,
          });
          return;
        }

        const ctx = new CommandContext(message, commandName, optionsResolver);
        await command.execute(ctx);
      } catch (error) {
        console.error(`[Error] Prefix command "${commandName}" failed:`, error);
        await message.channel.send({
          content: 'Something went wrong while executing that command.',
        });
      }
      return; // Do not award XP for command invocations
    }

    const { author, guild } = message;

    // Increment message count and grant XP on every message
    const record = await prisma.guildMember.upsert({
      where:  { userId_guildId: { userId: author.id, guildId: guild.id } },
      update: { messageCount: { increment: 1 }, xp: { increment: XP_PER_MESSAGE } },
      create: { userId: author.id, guildId: guild.id, messageCount: 1, xp: XP_PER_MESSAGE, rankLevel: 1 },
    });

    const currentLevel = record.rankLevel;
    const newXp        = record.xp;

    // Fetch effective names and flair once — reused for both Stardust assignment and rank-up
    const [effectiveRanks, flair] = await Promise.all([
      getAllEffectiveRanks(guild.id),
      getUserFlair(author.id, guild.id),
    ]);

    const member = guild.members.cache.get(author.id)
      ?? await guild.members.fetch(author.id).catch(() => null);

    // Assign Stardust on first message and announce in channel
    if (record.messageCount === 1) {
      const stardustDef  = RANKS.find(r => r.level === 1);
      const stardustEff  = effectiveRanks.find(r => r.level === 1);
      const stargazerEff = effectiveRanks.find(r => r.level === 2);

      let alreadyHadRole = false;
      if (member) {
        try {
          const role = await getOrCreateRankRole(guild, stardustDef, stardustEff.effectiveName);
          alreadyHadRole = member.roles.cache.has(role.id);
          await member.roles.add(role);
        } catch (err) {
          console.error(`[Rank] Failed to assign Stardust to ${author.tag}:`, err.message);
        }
      }

      if (!alreadyHadRole) {
        message.channel.send({
          embeds: [
            Embeds.info({
              title:       '🌌 Rank Up!',
              description: `Welcome to the ranks, <@${author.id}>${flair ? ` ${flair}` : ''}!`,
              color:       stardustDef.color,
              thumbnail:   author.displayAvatarURL(),
              footer:      'Eclipse Bot • Ranking System',
              fields: [
                { name: '🏅 New Rank', value: stardustEff.effectiveName, inline: true },
                { name: '📈 Next Rank', value: stargazerEff.effectiveName },
              ],
            }),
          ],
        }).catch(() => null);
      }
      return;
    }

    const earnedLevel = getRankForXp(newXp).level;
    if (earnedLevel <= currentLevel) {
      // No rank-up — but silently restore role if leadership removed it
      if (member) {
        try {
          const currentRankDef  = RANKS.find(r => r.level === currentLevel);
          const currentEffective = effectiveRanks.find(r => r.level === currentLevel);
          const currentRole     = await getOrCreateRankRole(guild, currentRankDef, currentEffective.effectiveName);
          if (!member.roles.cache.has(currentRole.id)) {
            await removeAllRankRoles(member, effectiveRanks);
            await member.roles.add(currentRole);
          }
        } catch (err) {
          console.error(`[Rank] Role restoration failed for ${author.tag}:`, err.message);
        }
      }
      return;
    }

    // Persist the new level
    await prisma.guildMember.update({
      where: { userId_guildId: { userId: author.id, guildId: guild.id } },
      data:  { rankLevel: earnedLevel },
    });

    const newRank      = RANKS.find(r => r.level === earnedLevel);
    const nextRank     = getNextRank(earnedLevel);
    const newEffective = effectiveRanks.find(r => r.level === earnedLevel);

    // Role management
    if (member) {
      try {
        await removeAllRankRoles(member, effectiveRanks);
        const newRole = await getOrCreateRankRole(guild, newRank, newEffective.effectiveName);
        await member.roles.add(newRole);
      } catch (err) {
        console.error(`[Rank] Role assignment failed for ${author.tag}:`, err.message);
      }
    }

    // Post rank-up embed in the channel
    const nextEffective = nextRank ? effectiveRanks.find(r => r.level === nextRank.level) : null;

    const fields = [
      { name: '🏅 New Rank', value: newEffective.effectiveName, inline: true },
    ];

    if (nextRank) {
      fields.push({ name: '📈 Next Rank', value: nextEffective.effectiveName });
    } else {
      fields.push({ name: '👑 Status', value: 'Maximum rank achieved — Eclipse Ascendant!' });
    }

    message.channel.send({
      embeds: [
        Embeds.info({
          title:       '🌌 Rank Up!',
          description: `Congratulations <@${author.id}>${flair ? ` ${flair}` : ''}!`,
          color:       newRank.color,
          thumbnail:   author.displayAvatarURL(),
          footer:      'Eclipse Bot • Ranking System',
          fields,
        }),
      ],
    }).catch(() => null);
  },
};
