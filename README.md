# eclipse-bot-v2

A Discord bot for **Reddit Eclipse** — a Clash of Clans community server.

---

## Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- A Discord application with a bot token ([Discord Developer Portal](https://discord.com/developers/applications))
  - **Message Content Intent** must be enabled under *Bot → Privileged Gateway Intents* (required for prefix commands)
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

Every command is available as both a slash command (`/`) and a prefix command (`~` by default).

### Misc

| Slash | Prefix | Who can use | Description |
|---|---|---|---|
| `/ping` | `~ping` | Everyone | Check bot latency |
| `/help` | `~help` | Everyone | List available commands |
| `/invite` | `~invite` | Everyone | Get the server invite link |

### Ranks

| Slash | Prefix | Who can use | Description |
|---|---|---|---|
| `/rank [user]` | `~rank [user]` | Everyone | View your rank or another member's rank |
| `/leaderboard [sort] [count]` | `~leaderboard [sort] [count]` | Everyone | View server leaderboards |
| `/ranks setname <level> <name>` | `~ranks setname <level> <name>` | Admin, Leadership | Override a rank name for this server |
| `/ranks resetname <level>` | `~ranks resetname <level>` | Admin, Leadership | Reset a rank name to default |

### Clan

| Slash | Prefix | Who can use | Description |
|---|---|---|---|
| `/clan` | `~clan` | Elder, Co-Leader | Fetch current clan data from the CoC API |
| `/helper` | `~helper` | Eclipse members | Role-based guide for clan members |
| `/time now` | `~time now` | Everyone | Show the current clan time (Eastern) |
| `/time convert <time> <from> <to>` | `~time convert <time> <from> <to>` | Everyone | Convert a time between timezones |

### Moderation

| Slash | Prefix | Who can use | Description |
|---|---|---|---|
| `/mute <user> <duration> [reason]` | `~mute <user> <duration> [reason]` | Leadership, Co-Leader, Admin | Mute a member for a set duration |
| `/unmute <user> [reason]` | `~unmute <user> [reason]` | Leadership, Co-Leader, Admin | Manually unmute a member |
| `/kick <user> [reason]` | `~kick <user> [reason]` | Co-Leader, Admin | Kick a member (co-leaders have a 1-hour cooldown) |
| `/ban user <user> [reason]` | `~ban user <user> [reason]` | Co-Leader, Admin | Ban a member |
| `/ban toggle` | `~ban toggle` | Admin | Toggle between gif mode and real ban mode |

### Flairs

| Slash | Prefix | Who can use | Description |
|---|---|---|---|
| `/flair set <user> <emoji>` | `~flair set <user> <emoji>` | Admin, Leadership | Set a flair for a user |
| `/flair remove <user>` | `~flair remove <user>` | Admin, Leadership | Remove a flair from a user |
| `/flair pick <emoji>` | `~flair pick <emoji>` | Everyone | Pick a flair for yourself from the pool |
| `/flair clear` | `~flair clear` | Everyone | Remove your own flair |
| `/flair view [user]` | `~flair view [user]` | Everyone | View a user's flair |
| `/flair pool add <emoji> [label]` | `~flair pool add <emoji> [label]` | Admin, Leadership | Add an emoji to the server flair pool |
| `/flair pool remove <emoji>` | `~flair pool remove <emoji>` | Admin, Leadership | Remove an emoji from the flair pool |
| `/flair pool list` | `~flair pool list` | Everyone | List all available flairs |

---

## Prefix Commands

The default prefix is `~`, configured in `src/config.js`.

### Specifying users

The `<user>` argument accepts any of the following:

| Format | Example |
|---|---|
| Mention | `@Username` |
| Snowflake ID | `123456789012345678` |
| Username | `Username` |
| Display name | `Server Nickname` |

### Multi-word arguments

The last argument of a command absorbs all remaining text, so reasons and labels do not need quotes:

```
~kick @User being disruptive in general
~mute @User 2h repeated rule violations
```

For any other multi-word argument that is not the last one, wrap it in quotes:

```
~time convert "3:30 PM" ET PT
~flair pool add 🌙 "Moon Flair"
```

### Changing the prefix

Open `src/config.js` and update the `prefix` field:

```js
prefix: '!',
```

---

## Adding Commands

1. Create a `.js` file inside `src/commands/<category>/`
2. Export a `data` (SlashCommandBuilder) and `execute` function. Commands automatically support both slash and prefix invocation — no extra work required:

```js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('example')
    .setDescription('An example command'),

  async execute(interaction) {
    // Works identically whether called via /example or ~example
    await interaction.reply('Hello!');
  },
};
```

3. Run `npm run deploy` to register the slash command with Discord

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
│   ├── interactionCreate.js ← Slash command dispatcher
│   └── messageCreate.js  ← Prefix command dispatcher + XP/ranking
├── lib/
│   └── prisma.js         ← Prisma client singleton
├── utils/
│   ├── checkRole.js      ← Role hierarchy helpers
│   ├── CommandContext.js ← Unified slash/prefix execution context
│   ├── prefixParser.js   ← Tokenizer, member resolver, and arg parser for prefix commands
│   └── muteScheduler.js  ← Handles timed unmutes
├── deploy-commands.js
└── index.js
prisma/
├── schema.prisma         ← Database schema
├── migrations/           ← Migration history (committed to git)
└── prisma.config.ts      ← Prisma 7 config (datasource + adapter)
```
