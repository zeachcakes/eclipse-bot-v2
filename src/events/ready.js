const { Events, ActivityType } = require('discord.js');
const prisma = require('../lib/prisma');
const { scheduleMute } = require('../utils/muteScheduler');

module.exports = {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    console.log(`[Ready] Logged in as ${client.user.tag}`);
    console.log(`[Ready] Serving ${client.guilds.cache.size} guild(s)`);
    client.user.setActivity('Watching the Eclipse', { type: ActivityType.Custom });

    // Restore active mutes that survived a bot restart
    try {
      const activeMutes = await prisma.mute.findMany({ where: { active: true } });
      for (const mute of activeMutes) {
        const guild = client.guilds.cache.get(mute.guildId);
        if (guild) scheduleMute(client, guild, mute);
      }
      if (activeMutes.length > 0) {
        console.log(`[Ready] Restored ${activeMutes.length} active mute(s).`);
      }
    } catch (err) {
      console.error('[Ready] Failed to restore mutes:', err);
    }
  },
};
