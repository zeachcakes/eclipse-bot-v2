const { Events } = require('discord.js');
const prisma = require('../lib/prisma');
const config = require('../config');

module.exports = {
  name: Events.GuildMemberAdd,

  async execute(member) {
    const mutedRoleId = config.role.muted;
    if (!mutedRoleId) return;

    const activeMute = await prisma.mute.findFirst({
      where: {
        userId: member.id,
        guildId: member.guild.id,
        active: true,
      },
    });

    if (!activeMute) return;

    // Mute already expired while user was away — let the scheduled timer deactivate it
    if (activeMute.expiresAt <= new Date()) return;

    try {
      await member.roles.add(mutedRoleId, 'Re-applying mute: member rejoined before mute expired');
      console.log(`[GuildMemberAdd] Re-applied mute for ${member.id} (expires ${activeMute.expiresAt.toISOString()})`);
    } catch (err) {
      console.error(`[GuildMemberAdd] Failed to re-apply muted role for ${member.id}:`, err);
    }
  },
};
