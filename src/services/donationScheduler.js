const prisma = require('../lib/prisma');
const cocApi = require('./cocApi');
const {
  getCurrentSeasonKey,
  getPrevSeasonKey,
  getFriendInNeedValue,
} = require('../utils/donationUtils');

const POLL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

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

  const links = await prisma.playerLink.findMany();
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
 * Starts the scheduler — runs an immediate check then polls every hour.
 */
function startDonationScheduler() {
  rolloverIfNeeded().catch(err =>
    console.error('[DonationScheduler] Initial rollover failed:', err),
  );
  setInterval(() => {
    rolloverIfNeeded().catch(err =>
      console.error('[DonationScheduler] Scheduled rollover failed:', err),
    );
  }, POLL_INTERVAL_MS);

  console.log('[DonationScheduler] Started — syncing donations every hour.');
}

module.exports = { startDonationScheduler, ensureCurrentSnapshot, rolloverIfNeeded };
