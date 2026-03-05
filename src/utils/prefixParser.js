/**
 * Prefix command argument parser.
 *
 * Introspects a command's SlashCommandBuilder schema to map positional prefix
 * arguments to named option values, mirroring what Discord does for slash commands.
 */

const OPTION_TYPES = {
  SUB_COMMAND:       1,
  SUB_COMMAND_GROUP: 2,
  STRING:            3,
  INTEGER:           4,
  BOOLEAN:           5,
  USER:              6,
  NUMBER:            10,
};

// ─── Tokenizer ────────────────────────────────────────────────────────────────

/**
 * Splits a string into tokens respecting single- and double-quoted spans.
 * e.g. tokenize('kick @user "being a pest"') → ['kick', '@user', 'being a pest']
 * @param {string} str
 * @returns {string[]}
 */
function tokenize(str) {
  const tokens = [];
  let cur = '';
  let inQuote = false;
  let quoteChar = '';

  for (const char of str) {
    if (inQuote) {
      if (char === quoteChar) {
        inQuote = false;
        if (cur) tokens.push(cur);
        cur = '';
      } else {
        cur += char;
      }
    } else if (char === '"' || char === "'") {
      inQuote = true;
      quoteChar = char;
    } else if (char === ' ' || char === '\t') {
      if (cur) tokens.push(cur);
      cur = '';
    } else {
      cur += char;
    }
  }

  if (cur) tokens.push(cur);
  return tokens;
}

// ─── Member resolution ────────────────────────────────────────────────────────

/**
 * Resolves a guild member from a mention, a snowflake ID, or a username /
 * display name (case-insensitive).
 * @param {import('discord.js').Guild} guild
 * @param {string} query
 * @returns {Promise<import('discord.js').GuildMember | null>}
 */
async function resolveMember(guild, query) {
  // <@123> or <@!123>
  const mentionMatch = query.match(/^<@!?(\d{17,19})>$/);
  if (mentionMatch) {
    return guild.members.fetch(mentionMatch[1]).catch(() => null);
  }

  // Raw snowflake ID
  if (/^\d{17,19}$/.test(query)) {
    return guild.members.fetch(query).catch(() => null);
  }

  // Username / display name / global name (searches cached members)
  await guild.members.fetch().catch(() => null);
  const lower = query.toLowerCase();
  return (
    guild.members.cache.find(
      m =>
        m.user.username.toLowerCase()     === lower ||
        m.displayName.toLowerCase()       === lower ||
        (m.user.globalName?.toLowerCase() === lower),
    ) ?? null
  );
}

// ─── Options resolver ─────────────────────────────────────────────────────────

/**
 * Provides a Discord ChatInputCommandInteraction-compatible options accessor
 * for prefix commands, so existing command execute() functions work unchanged.
 */
class OptionsResolver {
  /**
   * @param {{ subcommand: string|null, subcommandGroup: string|null, values: Map<string,any> }} parsed
   */
  constructor({ subcommand, subcommandGroup, values }) {
    this._subcommand      = subcommand;
    this._subcommandGroup = subcommandGroup;
    this._values          = values;
  }

  getSubcommand(_required = true)      { return this._subcommand; }
  getSubcommandGroup(_required = true) { return this._subcommandGroup; }
  getMember(name)                      { return this._values.get(name) ?? null; }
  getUser(name)                        { return (this._values.get(name))?.user ?? null; }
  getString(name)                      { const v = this._values.get(name); return v != null ? String(v) : null; }
  getInteger(name)                     { const v = this._values.get(name); return v != null ? Number(v)  : null; }
  getBoolean(name)                     { return this._values.get(name) ?? null; }
}

// ─── Core parser ──────────────────────────────────────────────────────────────

/**
 * Parses prefix command arguments against a command's slash schema.
 *
 * Routing:
 *   - If the schema has subcommand groups, the first token selects the group
 *     and the second selects the subcommand within that group.
 *   - If the schema has subcommands, the first token selects the subcommand.
 *   - The remaining tokens are matched positionally to the leaf option schema.
 *
 * Special string handling:
 *   The last option in the schema (if it is a STRING) consumes all remaining
 *   tokens joined by spaces, allowing natural multi-word inputs like reasons.
 *
 * @param {import('discord.js').Message} message
 * @param {import('@discordjs/builders').SlashCommandBuilder} commandData
 * @param {string[]} args  Tokens that follow the command name
 * @returns {Promise<OptionsResolver>}
 */
async function parseArgs(message, commandData, args) {
  const schema     = commandData.toJSON();
  const topOptions = schema.options ?? [];
  const remaining  = [...args];

  let subcommand      = null;
  let subcommandGroup = null;
  let leafOptions     = topOptions;

  const hasSubcmds = topOptions.some(
    o => o.type === OPTION_TYPES.SUB_COMMAND || o.type === OPTION_TYPES.SUB_COMMAND_GROUP,
  );

  if (hasSubcmds && remaining.length > 0) {
    const first    = remaining[0].toLowerCase();
    const groupDef = topOptions.find(
      o => o.type === OPTION_TYPES.SUB_COMMAND_GROUP && o.name === first,
    );

    if (groupDef) {
      subcommandGroup = groupDef.name;
      remaining.shift();

      if (remaining.length > 0) {
        const second = remaining[0].toLowerCase();
        const subDef = (groupDef.options ?? []).find(
          o => o.type === OPTION_TYPES.SUB_COMMAND && o.name === second,
        );
        if (subDef) {
          subcommand  = subDef.name;
          remaining.shift();
          leafOptions = subDef.options ?? [];
        }
      }
    } else {
      const subDef = topOptions.find(
        o => o.type === OPTION_TYPES.SUB_COMMAND && o.name === first,
      );
      if (subDef) {
        subcommand  = subDef.name;
        remaining.shift();
        leafOptions = subDef.options ?? [];
      }
    }
  }

  // Strip any nested subcommand entries that may appear in leafOptions
  leafOptions = leafOptions.filter(
    o => o.type !== OPTION_TYPES.SUB_COMMAND && o.type !== OPTION_TYPES.SUB_COMMAND_GROUP,
  );

  const values = new Map();

  for (let i = 0; i < leafOptions.length; i++) {
    if (remaining.length === 0) break;

    const opt        = leafOptions[i];
    const isLastOpt  = i === leafOptions.length - 1;

    switch (opt.type) {
      case OPTION_TYPES.USER: {
        const member = await resolveMember(message.guild, remaining.shift());
        values.set(opt.name, member);
        break;
      }

      case OPTION_TYPES.INTEGER: {
        const parsed = parseInt(remaining.shift(), 10);
        if (!isNaN(parsed)) values.set(opt.name, parsed);
        break;
      }

      case OPTION_TYPES.NUMBER: {
        const parsed = parseFloat(remaining.shift());
        if (!isNaN(parsed)) values.set(opt.name, parsed);
        break;
      }

      case OPTION_TYPES.STRING: {
        // The last string option absorbs all remaining tokens so multi-word
        // values (e.g. ban reasons) don't need quotes.
        if (isLastOpt && remaining.length > 1) {
          values.set(opt.name, remaining.join(' '));
          remaining.length = 0;
        } else {
          values.set(opt.name, remaining.shift());
        }
        break;
      }

      case OPTION_TYPES.BOOLEAN: {
        const raw = remaining.shift().toLowerCase();
        values.set(opt.name, raw === 'true' || raw === 'yes' || raw === '1');
        break;
      }

      default:
        remaining.shift(); // unknown type — consume and skip
    }
  }

  return new OptionsResolver({ subcommand, subcommandGroup, values });
}

// ─── Usage builder ────────────────────────────────────────────────────────────

/**
 * Builds a human-readable usage string for a command from its slash schema.
 * Subcommands each get their own line.
 * @param {string} prefix
 * @param {object} schema  Result of commandData.toJSON()
 * @returns {string}
 */
function buildUsage(prefix, schema) {
  const topOptions = schema.options ?? [];
  const hasSubcmds = topOptions.some(
    o => o.type === OPTION_TYPES.SUB_COMMAND || o.type === OPTION_TYPES.SUB_COMMAND_GROUP,
  );

  const formatArgs = opts =>
    (opts ?? [])
      .filter(o => o.type !== OPTION_TYPES.SUB_COMMAND && o.type !== OPTION_TYPES.SUB_COMMAND_GROUP)
      .map(o => (o.required ? `<${o.name}>` : `[${o.name}]`))
      .join(' ');

  if (!hasSubcmds) {
    const args = formatArgs(topOptions);
    return `\`${prefix}${schema.name}${args ? ' ' + args : ''}\``;
  }

  const lines = [];
  for (const opt of topOptions) {
    if (opt.type === OPTION_TYPES.SUB_COMMAND) {
      const args = formatArgs(opt.options);
      lines.push(`\`${prefix}${schema.name} ${opt.name}${args ? ' ' + args : ''}\``);
    } else if (opt.type === OPTION_TYPES.SUB_COMMAND_GROUP) {
      for (const sub of opt.options ?? []) {
        const args = formatArgs(sub.options);
        lines.push(`\`${prefix}${schema.name} ${opt.name} ${sub.name}${args ? ' ' + args : ''}\``);
      }
    }
  }
  return lines.join('\n');
}

module.exports = { parseArgs, tokenize, buildUsage, OptionsResolver, resolveMember };
