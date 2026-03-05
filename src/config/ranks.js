// Default rank definitions. Names can be overridden per-server via /ranks setname.
// XP thresholds follow the formula: 4000 * (2^(level-1) - 1)
// At 20 XP/message with a 60s cooldown, Eclipse Ascendant takes ~4.6 years for an average active member.
const RANKS = [
  { level: 1, name: 'Stardust',          threshold: 0,      color: 0x78909C },
  { level: 2, name: 'Stargazer',         threshold: 4000,   color: 0x5C6BC0 },
  { level: 3, name: 'Orbiter',           threshold: 12000,  color: 0x29B6F6 },
  { level: 4, name: 'Lunar Drift',       threshold: 28000,  color: 0xB0BEC5 },
  { level: 5, name: 'Solar Wanderer',    threshold: 60000,  color: 0xFFA726 },
  { level: 6, name: 'Corona',            threshold: 124000, color: 0xFF5722 },
  { level: 7, name: 'Totality',          threshold: 252000, color: 0xAB47BC },
  { level: 8, name: 'Eclipse Ascendant', threshold: 508000, color: 0xF4A500 },
];

module.exports = { RANKS };
