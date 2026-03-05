require('dotenv').config();

module.exports = {
  clanName: 'Reddit Eclipse',
  clanTag: '#9RVVPG2J',
  clan2Name: 'The Hidden Sun',
  clanTag2: '#LYPUC82Y',
  rules: 'https://www.reddit.com/r/RedditEclipse/wiki/clan_rules',
  password: 'https://www.reddit.com/r/redditclansystem/wiki/official_reddit_clan_system',
  subreddit: 'https://www.reddit.com/r/RedditEclipse/',
  defaultTimeZone: 'America/New_York',

  server: {
    eclipse: process.env.ECLIPSE,
  },

  categoryChannel: {
    clan: process.env.CLAN_CATEGORY,
    leadership: process.env.LEADERSHIP_CATEGORY,
    war_room: process.env.WARROOM_CATEGORY,
  },

  channel: {
    development: process.env.DEVELOPMENT,
    donations: process.env.DONATION,
    leader_notes: process.env.LEADERNOTES,
    leadership: process.env.LEADERSHIP,
    war_discussion: process.env.WARDISCUSSION,
    welcome: process.env.WELCOME,
    wmbot: process.env.WMBOT,
  },

  role: {
    admin: process.env.ADMIN_ROLE,
    bots: process.env.BOTS_ROLE,
    co_leader: process.env.CO_LEADER_ROLE,
    elder: process.env.ELDER_ROLE,
    eclipse: process.env.ECLIPSE_ROLE,
    hidden_sun: process.env.HIDDEN_SUN_ROLE,
    friends: process.env.FRIENDS_ROLE,
    inwar: process.env.INWAR_ROLE,
    leadership: process.env.LEADERSHIP_ROLE,
    muted: process.env.MUTED_ROLE,
    power_donator: process.env.POWERDONATOR_ROLE,
    visitor: process.env.VISITOR_ROLE,
    war_counselor: process.env.WARCOUNSELOR_ROLE,
    war_guest: process.env.WARGUEST_ROLE,
  },

  user: {
    luigi: process.env.LUIGI,
    peril: process.env.PERIL,
    prototype: process.env.PROTOTYPE,

  },

  clash: {
    achievementName: {
      clanGames: 'Games Champion',
      donations: 'Friend in Need',
    },
  },

  prefix: '~',
  multiplier: 0.24,
};
