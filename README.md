# eclipse-bot-v2

A Discord bot for **Reddit Eclipse** — a Clash of Clans community server.

---

## Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- A Discord application with a bot token ([Discord Developer Portal](https://discord.com/developers/applications))
- A Clash of Clans API token ([developer.clashofclans.com](https://developer.clashofclans.com))

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# Fill in your values in .env
```

### Environment Variables

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Your bot token from the Discord Developer Portal |
| `CLIENT_ID` | Your application's client ID |
| `GUILD_ID` | Dev server ID for instant command updates (leave empty for global) |
| `COC_API_TOKEN` | Clash of Clans API token |

### Using Multiple Environments

The bot supports switching between **development** and **production** environments:

- **`.env.development`** — Configuration for your development/testing guild
- **`.env.production`** — Configuration for your production guild

Set up both files with their respective guild IDs and other environment-specific values. The bot will automatically load the correct file based on the `NODE_ENV` environment variable.

---

## Running the Bot

```bash
# Development (auto-restarts on file changes, uses .env.development)
npm run dev-env

# Production (uses .env.production)
npm run prod-env

# Default (uses .env.development)
npm start
```

### Registering Slash Commands

Run this once after setup, and again whenever you add or remove commands:

```bash
npm run deploy
```

> Set `GUILD_ID` in `.env` during development — commands update instantly.
> Leave it empty for global deployment (takes up to 1 hour to propagate).

---

## Commands

| Command | Description |
|---|---|
| `/ping` | Check bot latency |
| `/help` | List all available commands |

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
4. It will automatically appear in `/help`

---

## Project Structure

```
src/
├── commands/
│   └── <category>/       ← group commands by feature (utility, coc, admin, ...)
│       └── command.js
├── events/
│   ├── ready.js
│   └── interactionCreate.js
├── deploy-commands.js
└── index.js
```
