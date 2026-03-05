const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const Embeds = require('../../utils/embeds');

const CLAN_TIMEZONE = 'America/New_York';

// Common abbreviation → IANA timezone map
const TIMEZONE_ALIASES = {
  et: 'America/New_York',
  est: 'America/New_York',
  edt: 'America/New_York',
  eastern: 'America/New_York',
  ct: 'America/Chicago',
  cst: 'America/Chicago',
  cdt: 'America/Chicago',
  central: 'America/Chicago',
  mt: 'America/Denver',
  mst: 'America/Denver',
  mdt: 'America/Denver',
  mountain: 'America/Denver',
  pt: 'America/Los_Angeles',
  pst: 'America/Los_Angeles',
  pdt: 'America/Los_Angeles',
  pacific: 'America/Los_Angeles',
  utc: 'UTC',
  gmt: 'UTC',
  uk: 'Europe/London',
  bst: 'Europe/London',
  cet: 'Europe/Paris',
  ist: 'Asia/Kolkata',
  jst: 'Asia/Tokyo',
  aest: 'Australia/Sydney',
  nzst: 'Pacific/Auckland',
};

/**
 * Resolves a user-provided timezone string to an IANA name.
 * Returns null if unrecognised.
 * @param {string} input
 * @returns {string | null}
 */
function resolveTimezone(input) {
  const key = input.trim().toLowerCase();
  if (TIMEZONE_ALIASES[key]) return TIMEZONE_ALIASES[key];

  try {
    Intl.DateTimeFormat(undefined, { timeZone: input });
    return input;
  } catch {
    return null;
  }
}

/**
 * Formats a Date in a given IANA timezone.
 * @param {Date} date
 * @param {string} tz
 * @returns {string}
 */
function formatInTz(date, tz) {
  return date.toLocaleString('en-US', {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
}

/**
 * Parses "3:30 PM", "11:00am", or "15:30" into { hours, minutes }.
 * Returns null if invalid.
 * @param {string} input
 * @returns {{ hours: number, minutes: number } | null}
 */
function parseTime(input) {
  const clean = input.trim();

  const match12 = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2] ?? '0', 10);
    const period = match12[3].toLowerCase();
    if (hours < 1 || hours > 12 || minutes > 59) return null;
    if (period === 'am') { if (hours === 12) hours = 0; }
    else                 { if (hours !== 12) hours += 12; }
    return { hours, minutes };
  }

  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours   = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes };
  }

  return null;
}

/**
 * Returns the UTC offset in ms for a given IANA timezone at a given Date.
 * @param {string} tz
 * @param {Date} date
 * @returns {number}
 */
function getUtcOffsetMs(tz, date) {
  const fmt = (timeZone) =>
    date.toLocaleString('en-US', {
      timeZone, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  return new Date(fmt(tz)) - new Date(fmt('UTC'));
}

/**
 * Builds a Date representing the given wall-clock time in fromTz (using today's date).
 * @param {{ hours: number, minutes: number }} time
 * @param {string} fromTz
 * @returns {Date}
 */
function buildDateInTz({ hours, minutes }, fromTz) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: fromTz,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);

  const year  = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day   = parts.find(p => p.type === 'day').value;

  const isoLike = `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  const tempDate = new Date(`${isoLike}Z`);
  return new Date(tempDate.getTime() - getUtcOffsetMs(fromTz, tempDate));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('time')
    .setDescription('Time utilities for the clan')
    .addSubcommand(sub =>
      sub
        .setName('now')
        .setDescription('Show the current clan time (Eastern)')
    )
    .addSubcommand(sub =>
      sub
        .setName('convert')
        .setDescription('Convert a time between timezones')
        .addStringOption(opt =>
          opt.setName('time').setDescription('Time to convert (e.g. 3:30 PM or 15:30)').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('from').setDescription('Source timezone (e.g. ET, PT, UTC, Asia/Tokyo)').setRequired(true)
        )
        .addStringOption(opt =>
          opt.setName('to').setDescription('Target timezone (e.g. ET, PT, UTC, Asia/Tokyo)').setRequired(true)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'now') {
      const now = new Date();
      const unix = Math.floor(now.getTime() / 1000);

      return interaction.reply({
        embeds: [
          Embeds.info({
            title: '🕐 Clan Time',
            description: '**Reddit Eclipse** follows **Eastern Time**.',
            color: Embeds.COLORS.time,
            footer: 'Eclipse Bot • Automatically adjusts for EST / EDT',
            fields: [
              { name: '📍 Eastern Time',   value: formatInTz(now, CLAN_TIMEZONE), inline: true },
              { name: '🌍 Your Local Time', value: `<t:${unix}:F>`,              inline: true },
              { name: '⏰ Relative',        value: `<t:${unix}:R>`,              inline: false },
            ],
          }),
        ],
      });
    }

    if (sub === 'convert') {
      const timeInput = interaction.options.getString('time');
      const fromInput = interaction.options.getString('from');
      const toInput   = interaction.options.getString('to');

      const parsed = parseTime(timeInput);
      if (!parsed) {
        return interaction.reply({
          content: 'Invalid time format. Use `3:30 PM`, `11:00am`, or `15:30`.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const fromTz = resolveTimezone(fromInput);
      if (!fromTz) {
        return interaction.reply({
          content: `Unrecognised timezone: \`${fromInput}\`. Try \`ET\`, \`PT\`, \`UTC\`, or an IANA name like \`America/New_York\`.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const toTz = resolveTimezone(toInput);
      if (!toTz) {
        return interaction.reply({
          content: `Unrecognised timezone: \`${toInput}\`. Try \`ET\`, \`PT\`, \`UTC\`, or an IANA name like \`America/New_York\`.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const date = buildDateInTz(parsed, fromTz);
      const unix = Math.floor(date.getTime() / 1000);

      return interaction.reply({
        embeds: [
          Embeds.info({
            title: '🔄 Time Conversion',
            color: Embeds.COLORS.time,
            footer: 'Eclipse Bot • Based on today\'s date for DST accuracy',
            fields: [
              { name: '📤 From',           value: formatInTz(date, fromTz), inline: true },
              { name: '📥 To',             value: formatInTz(date, toTz),   inline: true },
              { name: '🌍 Your Local Time', value: `<t:${unix}:F>`,         inline: false },
            ],
          }),
        ],
      });
    }
  },
};
