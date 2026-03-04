-- CreateTable
CREATE TABLE "Mute" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KickLog" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KickLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KickCooldown" (
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "lastKickAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KickCooldown_pkey" PRIMARY KEY ("userId","guildId")
);

-- CreateTable
CREATE TABLE "WarnLog" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarnLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Mute_userId_guildId_idx" ON "Mute"("userId", "guildId");

-- CreateIndex
CREATE INDEX "Mute_active_expiresAt_idx" ON "Mute"("active", "expiresAt");

-- CreateIndex
CREATE INDEX "KickLog_userId_guildId_idx" ON "KickLog"("userId", "guildId");

-- CreateIndex
CREATE INDEX "WarnLog_userId_guildId_idx" ON "WarnLog"("userId", "guildId");
