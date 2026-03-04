const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const Embeds = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all available commands'),

  async execute(interaction) {
    const commandsPath = path.join(__dirname, '..');
    const categoryFolders = fs.readdirSync(commandsPath);

    const fields = [];

    for (const folder of categoryFolders) {
      const folderPath = path.join(commandsPath, folder);
      if (!fs.statSync(folderPath).isDirectory()) continue;

      const commandFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
      const lines = [];

      for (const file of commandFiles) {
        const command = require(path.join(folderPath, file));
        if (!command.data) continue;
        lines.push(`\`/${command.data.name}\` — ${command.data.description}`);
      }

      if (lines.length > 0) {
        const categoryName = folder.charAt(0).toUpperCase() + folder.slice(1);
        fields.push({ name: categoryName, value: lines.join('\n') });
      }
    }

    await interaction.reply({
      embeds: [
        Embeds.info({
          title: '📖 Eclipse Bot — Commands',
          footer: 'Use / to invoke any command',
          fields,
        }),
      ],
      ephemeral: true,
    });
  },
};
