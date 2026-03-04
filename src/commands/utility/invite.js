const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Get the invite link for the Reddit Eclipse Discord server'),

  async execute(interaction) {
    await interaction.reply({
      content: 'Join **Reddit Eclipse**: https://discord.gg/u9jkT8U3hT',
      ephemeral: true,
    });
  },
};
