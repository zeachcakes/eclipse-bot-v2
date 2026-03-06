-- AlterTable
ALTER TABLE "DonationSeasonSnapshot" ADD COLUMN     "currentSeasonDonations" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "DonationSeasonSnapshot_playerTag_idx" ON "DonationSeasonSnapshot"("playerTag");
