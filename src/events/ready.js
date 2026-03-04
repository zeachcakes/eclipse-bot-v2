const { Events, ActivityType } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,

  execute(client) {
    console.log(`[Ready] Logged in as ${client.user.tag}`);
    console.log(`[Ready] Serving ${client.guilds.cache.size} guild(s)`);
    client.user.setActivity('Watching the Eclipse', { type: ActivityType.Custom });
  },
};
