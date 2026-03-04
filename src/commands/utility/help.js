const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all available commands'),

  async execute(interaction) {
    const commandsPath = path.join(__dirname, '..');
    const categoryFolders = fs.readdirSync(commandsPath);

    const embed = new EmbedBuilder()
      .setTitle('Eclipse Bot — Commands')
      .setColor(0xF4A500) // Clash of Clans gold
      .setFooter({ text: 'Use / to invoke any command' })
      .setTimestamp();

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
        embed.addFields({ name: categoryName, value: lines.join('\n') });
      }
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
