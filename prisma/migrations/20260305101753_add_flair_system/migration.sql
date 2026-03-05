-- CreateTable
CREATE TABLE "UserFlair" (
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "flair" TEXT NOT NULL,

    CONSTRAINT "UserFlair_pkey" PRIMARY KEY ("userId","guildId")
);

-- CreateTable
CREATE TABLE "GuildFlairPool" (
    "guildId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "label" TEXT,

    CONSTRAINT "GuildFlairPool_pkey" PRIMARY KEY ("guildId","emoji")
);
