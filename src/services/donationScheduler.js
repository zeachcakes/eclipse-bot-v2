const prisma = require('../lib/prisma');
const cocApi = require('./cocApi');
const {
  getCurrentSeasonKey,
  getPrevSeasonKey,
  getFriendInNeedValue,
} = require('../utils/donationUtils');

const POLL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * For every linked player that lacks a snapshot for the current season:
 *  1. Fetches their current "Friend in Need" achievement value.
 *  2. Finalises the previous season's record (sets finalDonations).
 *  3. Creates the baseline snapshot for the current season.
 */
async function rolloverIfNeeded() {
  const seasonKey = getCurrentSeasonKey();
  const prevKey   = getPrevSeasonKey(seasonKey);

  const links = await prisma.playerLink.findMany();
  if (links.length === 0) return;

  // Only process players that don't yet have a snapshot for this season
  const existingSnapshots = await prisma.donationSeasonSnapshot.findMany({
    where: { seasonKey, playerTag: { in: links.map(l => l.playerTag) } },
    select: { playerTag: true },
  });
  const alreadySnapped = new Set(existingSnapshots.map(s => s.playerTag));

  const pending = links.filter(l => !alreadySnapped.has(l.playerTag));
  if (pending.length === 0) return;

  console.log(`[DonationScheduler] Rolling over ${pending.length} player(s) to season ${seasonKey}.`);

  await Promise.allSettled(
    pending.map(async ({ playerTag }) => {
      try {
        const player       = await cocApi.getPlayer(playerTag);
        const currentValue = getFriendInNeedValue(player);

        // Finalise previous season if it exists and hasn't been finalised yet
        const prevSnapshot = await prisma.donationSeasonSnapshot.findUnique({
          where: { playerTag_seasonKey: { playerTag, seasonKey: prevKey } },
        });

        if (prevSnapshot && prevSnapshot.finalDonations === null) {
          await prisma.donationSeasonSnapshot.update({
            where: { playerTag_seasonKey: { playerTag, seasonKey: prevKey } },
            data:  { finalDonations: Math.max(0, currentValue - prevSnapshot.baselineAchievement) },
          });
        }

        // Create current-season baseline
        await prisma.donationSeasonSnapshot.create({
          data: { playerTag, seasonKey, baselineAchievement: currentValue },
        });
      } catch (err) {
        console.error(`[DonationScheduler] Failed to snapshot ${playerTag}:`, err.message);
      }
    }),
  );
}

/**
 * Ensures a snapshot exists for `playerTag` in the current season.
 * Called immediately after a player links their account so they start
 * accumulating from today rather than waiting for the next scheduler tick.
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
    data: { playerTag, seasonKey, baselineAchievement: currentValue },
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

  console.log('[DonationScheduler] Started — checking season rollover every hour.');
}

module.exports = { startDonationScheduler, ensureCurrentSnapshot };
