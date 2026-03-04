const { EmbedBuilder } = require('discord.js');
const prisma = require('../lib/prisma');
const config = require('../config');

async function sendLog(client, embed) {
  const logChannelId = config.channel.leader_notes;
  if (!logChannelId) return;
  try {
    const logChannel = await client.channels.fetch(logChannelId);
    if (logChannel) await logChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error('[MuteScheduler] Failed to send log:', err);
  }
}

async function expireMute(client, guild, muteRecord) {
  const mutedRoleId = config.role.muted;

  try {
    const member = await guild.members.fetch(muteRecord.userId);
    if (member.roles.cache.has(mutedRoleId)) {
      await member.roles.remove(mutedRoleId, 'Mute duration expired');
    }
  } catch (err) {
    // Member may have left the server — still clean up the DB record
    console.warn(`[MuteScheduler] Could not remove muted role for ${muteRecord.userId}:`, err.message);
  }

  try {
    await prisma.mute.update({ where: { id: muteRecord.id }, data: { active: false } });
  } catch (err) {
    console.error('[MuteScheduler] Failed to deactivate mute record:', err);
  }

  await sendLog(client, new EmbedBuilder()
    .setTitle('Member Unmuted (Auto)')
    .setColor(0x57F287)
    .setDescription(`<@${muteRecord.userId}> has been automatically unmuted.`)
    .setFooter({ text: `User ID: ${muteRecord.userId}` })
    .setTimestamp(),
  );
}

/**
 * Schedules the automatic unmute for a mute record.
 * If the mute has already expired, unmutes immediately.
 */
function scheduleMute(client, guild, muteRecord) {
  const remaining = muteRecord.expiresAt.getTime() - Date.now();

  if (remaining <= 0) {
    expireMute(client, guild, muteRecord);
    return;
  }

  setTimeout(() => expireMute(client, guild, muteRecord), remaining);
}

module.exports = { scheduleMute };
