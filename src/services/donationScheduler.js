const prisma = require('../lib/prisma');
const cocApi = require('./cocApi');
const config = require('../config');
const {
  getCurrentSeasonKey,
  getPrevSeasonKey,
  getFriendInNeedValue,
} = require('../utils/donationUtils');

const POLL_INTERVAL_MS  = 60 * 60 * 1000; // 1 hour
const LEFT_TTL_DAYS     = 10;
const LEFT_TTL_MS       = LEFT_TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Syncs the ClanMember table against the live clan rosters.
 *
 * - Upserts a record for every current member (clears leftAt if they rejoined).
 * - Sets leftAt = now() for members no longer in either roster (if not already set).
 * - Deletes members whose leftAt is older than LEFT_TTL_DAYS (cascades snapshots).
 */
async function syncClanRoster() {
  const [clan1, clan2] = await Promise.all([
    cocApi.getClan(config.clanTag),
    cocApi.getClan(config.clanTag2),
  ]);

  const currentMembers = new Map();
  for (const m of (clan1.memberList ?? [])) {
    currentMembers.set(m.tag, { playerName: m.name, clanTag: config.clanTag });
  }
  for (const m of (clan2.memberList ?? [])) {
    if (!currentMembers.has(m.tag)) {
      currentMembers.set(m.tag, { playerName: m.name, clanTag: config.clanTag2 });
    }
  }

  if (currentMembers.size === 0) return;

  // Upsert all current members (reset leftAt to null for any who rejoined)
  await Promise.all(
    [...currentMembers.entries()].map(([playerTag, { playerName, clanTag }]) =>
      prisma.clanMember.upsert({
        where:  { playerTag },
        update: { playerName, clanTag, leftAt: null },
        create: { playerTag, playerName, clanTag },
      }),
    ),
  );

  // Mark members no longer in the roster as left (only if leftAt not yet set)
  await prisma.clanMember.updateMany({
    where: {
      playerTag: { notIn: [...currentMembers.keys()] },
      leftAt:    null,
    },
    data: { leftAt: new Date() },
  });

  // Delete members who have been gone for more than LEFT_TTL_DAYS (cascades snapshots)
  const cutoff = new Date(Date.now() - LEFT_TTL_MS);
  const deleted = await prisma.clanMember.deleteMany({
    where: { leftAt: { lte: cutoff } },
  });

  if (deleted.count > 0) {
    console.log(`[DonationScheduler] Removed ${deleted.count} ex-member(s) after ${LEFT_TTL_DAYS}-day grace period.`);
  }
}

/**
 * Each tick handles all linked players in two groups:
 *
 * Group A — no snapshot for current season (rollover):
 *   1. Finalises previous season's finalDonations.
 *   2. Creates the new season baseline snapshot (currentSeasonDonations = 0).
 *
 * Group B — already have a snapshot (mid-season refresh):
 *   1. Fetches current "Friend in Need" value.
 *   2. Updates currentSeasonDonations = max(0, currentFiN − baseline).
 */
async function rolloverIfNeeded() {
  const seasonKey = getCurrentSeasonKey();
  const prevKey   = getPrevSeasonKey(seasonKey);

  const links = await prisma.clanMember.findMany({
    where: { userId: { not: null }, leftAt: null },
  });
  if (links.length === 0) return { rolledOver: 0, refreshed: 0 };

  const allTags = links.map(l => l.playerTag);

  const existingSnapshots = await prisma.donationSeasonSnapshot.findMany({
    where:  { seasonKey, playerTag: { in: allTags } },
    select: { playerTag: true, baselineAchievement: true },
  });

  const snapshotMap = new Map(existingSnapshots.map(s => [s.playerTag, s.baselineAchievement]));
  const groupA      = links.filter(l => !snapshotMap.has(l.playerTag)); // rollover
  const groupB      = links.filter(l =>  snapshotMap.has(l.playerTag)); // mid-season refresh

  if (groupA.length > 0) {
    console.log(`[DonationScheduler] Rolling over ${groupA.length} player(s) to season ${seasonKey}.`);
  }

  const counts = { rolledOver: groupA.length, refreshed: groupB.length };

  await Promise.allSettled([
    // ── Group A: rollover ────────────────────────────────────────────────────
    ...groupA.map(async ({ playerTag }) => {
      try {
        const player       = await cocApi.getPlayer(playerTag);
        const currentValue = getFriendInNeedValue(player);

        // Finalise previous season if not yet done
        const prevSnapshot = await prisma.donationSeasonSnapshot.findUnique({
          where: { playerTag_seasonKey: { playerTag, seasonKey: prevKey } },
        });
        if (prevSnapshot && prevSnapshot.finalDonations === null) {
          await prisma.donationSeasonSnapshot.update({
            where: { playerTag_seasonKey: { playerTag, seasonKey: prevKey } },
            data:  { finalDonations: Math.max(0, currentValue - prevSnapshot.baselineAchievement) },
          });
        }

        await prisma.donationSeasonSnapshot.create({
          data: { playerTag, seasonKey, baselineAchievement: currentValue, currentSeasonDonations: 0 },
        });
      } catch (err) {
        console.error(`[DonationScheduler] Rollover failed for ${playerTag}:`, err.message);
      }
    }),

    // ── Group B: mid-season refresh ──────────────────────────────────────────
    ...groupB.map(async ({ playerTag }) => {
      try {
        const player       = await cocApi.getPlayer(playerTag);
        const currentValue = getFriendInNeedValue(player);
        const baseline     = snapshotMap.get(playerTag);

        await prisma.donationSeasonSnapshot.update({
          where: { playerTag_seasonKey: { playerTag, seasonKey } },
          data:  { currentSeasonDonations: Math.max(0, currentValue - baseline) },
        });
      } catch (err) {
        console.error(`[DonationScheduler] Refresh failed for ${playerTag}:`, err.message);
      }
    }),
  ]);

  return counts;
}

/**
 * Ensures a snapshot exists for `playerTag` in the current season.
 * Called immediately after a player links their account.
 * @param {string} playerTag
 */
async function ensureCurrentSnapshot(playerTag) {
  const seasonKey = getCurrentSeasonKey();

  const existing = await prisma.donationSeasonSnapshot.findUnique({
    where: { playerTag_seasonKey: { playerTag, seasonKey } },
  });
  if (existing) return;

  const player       = await cocApi.getPlayer(playerTag);
  const currentValue = getFriendInNeedValue(player);

  await prisma.donationSeasonSnapshot.create({
    data: { playerTag, seasonKey, baselineAchievement: currentValue, currentSeasonDonations: 0 },
  });
}

/**
 * Runs one full scheduler tick: roster sync followed by donation rollover/refresh.
 */
async function tick() {
  await syncClanRoster().catch(err =>
    console.error('[DonationScheduler] Roster sync failed:', err),
  );
  await rolloverIfNeeded().catch(err =>
    console.error('[DonationScheduler] Rollover failed:', err),
  );
}

/**
 * Starts the scheduler — runs an immediate tick then polls every hour.
 */
function startDonationScheduler() {
  tick();
  setInterval(tick, POLL_INTERVAL_MS);
  console.log('[DonationScheduler] Started — syncing roster and donations every hour.');
}

module.exports = { startDonationScheduler, ensureCurrentSnapshot, rolloverIfNeeded, syncClanRoster };
