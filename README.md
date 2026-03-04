# eclipse-bot-v2

A Discord bot for **Reddit Eclipse** — a Clash of Clans community server.

---

## Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- A Discord application with a bot token ([Discord Developer Portal](https://discord.com/developers/applications))
- A Clash of Clans API token ([developer.clashofclans.com](https://developer.clashofclans.com))
- A PostgreSQL database (local or hosted)

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env.development
# Fill in your values — see Environment Variables below

# 3. Generate the Prisma client
npm run db:generate

# 4. Run database migrations
npm run db:migrate

# 5. Register slash commands with Discord
npm run deploy
```

---

### Environment Variables

Both `.env.development` and `.env.production` are required. Neither is committed to git — keep them local.

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Bot token from the Discord Developer Portal |
| `CLIENT_ID` | Application client ID |
| `GUILD_ID` | Dev server ID for instant command updates (leave empty for global) |
| `COC_API_TOKEN` | Clash of Clans API token |
| `DATABASE_URL` | PostgreSQL connection string — `postgresql://user:pass@localhost:5432/dbname` |
| `ADMIN_ROLE` | Discord role ID for admins |
| `CO_LEADER_ROLE` | Discord role ID for co-leaders |
| `ELDER_ROLE` | Discord role ID for elders |
| `ECLIPSE_ROLE` | Discord role ID for Eclipse members |
| `LEADERSHIP_ROLE` | Discord role ID for leadership |
| `MUTED_ROLE` | Discord role ID assigned when a member is muted |
| `LEADERNOTES` | Channel ID where mod actions are logged |

> See `.env.example` for the full list of variables.

### Using Multiple Environments

- **`.env.development`** — configuration for your dev/test guild
- **`.env.production`** — configuration for your production guild

The bot loads the correct file based on the `NODE_ENV` environment variable.

---

## Running the Bot

```bash
# Development (auto-restarts on file changes, uses .env.development)
npm run dev-env

# Production (uses .env.production)
npm run prod-env
```

---

## Database

The bot uses **PostgreSQL** via [Prisma ORM](https://www.prisma.io/).

```bash
# Apply schema changes to the database (creates tables on first run)
npm run db:migrate

# Push schema without creating a migration file (quick local testing)
npm run db:push

# Open Prisma Studio — visual database browser
npm run db:studio

# Regenerate the Prisma client after schema changes
npm run db:generate
```

### What's stored

| Table | Purpose |
|---|---|
| `Mute` | Active and historical mutes — survives bot restarts |
| `KickLog` | Full kick history |
| `KickCooldown` | Tracks co-leader kick cooldowns across restarts |
| `WarnLog` | Member warnings |

---

## Commands

| Command | Who can use | Description |
|---|---|---|
| `/ping` | Everyone | Check bot latency |
| `/help` | Everyone | List available commands |
| `/invite` | Everyone | Get the server invite link |
| `/mute` | Leadership, Co-Leader, Admin | Mute a member for a set duration |
| `/unmute` | Leadership, Co-Leader, Admin | Manually unmute a member |
| `/kick` | Co-Leader, Admin | Kick a member (co-leaders have a 1-hour cooldown) |

---

## Adding Commands

1. Create a `.js` file inside `src/commands/<category>/`
2. Export a `data` (SlashCommandBuilder) and `execute` function:

```js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('example')
    .setDescription('An example command'),

  async execute(interaction) {
    await interaction.reply('Hello!');
  },
};
```

3. Run `npm run deploy` to register it with Discord

---

## Project Structure

```
src/
├── commands/
│   ├── coc/              ← Clash of Clans commands
│   ├── helper/           ← Role-based helper guides
│   └── utility/          ← General commands (mute, kick, ping, ...)
├── events/
│   ├── ready.js          ← Bot startup, restores active mutes
│   └── interactionCreate.js
├── lib/
│   └── prisma.js         ← Prisma client singleton
├── utils/
│   ├── checkRole.js      ← Role hierarchy helpers
│   └── muteScheduler.js  ← Handles timed unmutes
├── deploy-commands.js
└── index.js
prisma/
├── schema.prisma         ← Database schema
├── migrations/           ← Migration history (committed to git)
└── prisma.config.ts      ← Prisma 7 config (datasource + adapter)
```
