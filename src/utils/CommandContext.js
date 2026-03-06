/**
 * CommandContext — a unified command execution context.
 *
 * Wraps a Discord Message and exposes the same surface area as a
 * ChatInputCommandInteraction so that every command's execute() function
 * works identically whether it was invoked via a slash command or a prefix.
 *
 * Usage (prefix path only — slash commands pass the interaction directly):
 *
 *   const ctx = new CommandContext(message, commandName, optionsResolver);
 *   await command.execute(ctx);
 */
class CommandContext {
  /**
   * @param {import('discord.js').Message} message
   * @param {string} commandName
   * @param {import('./prefixParser').OptionsResolver} optionsResolver
   */
  constructor(message, commandName, optionsResolver) {
    this._message   = message;
    this._sentReply = null;

    /** Mirrors interaction.replied */
    this.replied = false;
    /** Mirrors interaction.deferred */
    this.deferred = false;

    // ── Properties that mirror ChatInputCommandInteraction ──────────────────
    this.commandName      = commandName;
    this.user             = message.author;
    this.member           = message.member;
    this.guild            = message.guild;
    this.channel          = message.channel;
    this.client           = message.client;
    this.createdTimestamp = message.createdTimestamp;
    this.options          = optionsResolver;
  }

  // ── Interaction compatibility methods ─────────────────────────────────────

  /** Always true — keeps type-guard checks in commands working. */
  isChatInputCommand() {
    return true;
  }

  /**
   * Sends a reply to the channel.
   * `flags` (ephemeral) and `fetchReply` are silently ignored since regular
   * messages don't support them; the sent Message is always returned.
   *
   * @param {string | import('discord.js').MessageCreateOptions} options
   * @returns {Promise<import('discord.js').Message>}
   */
  async reply(options) {
    const payload       = _buildPayload(options);
    this._sentReply     = await this._message.channel.send(payload);
    this.replied        = true;
    return this._sentReply;
  }

  /**
   * Edits the previously sent reply (or sends one if none exists yet).
   * @param {string | import('discord.js').MessageEditOptions} options
   * @returns {Promise<import('discord.js').Message>}
   */
  async editReply(options) {
    const payload = _buildPayload(options);
    if (this._sentReply) {
      // Clear the ⏳ placeholder set by deferReply if no content is provided
      if (this.deferred && !('content' in payload)) {
        payload.content = '';
      }
      return this._sentReply.edit(payload);
    }
    // Fallback: no prior reply — send a new one
    this._sentReply = await this._message.channel.send(payload);
    this.replied    = true;
    return this._sentReply;
  }

  /**
   * Sends an additional message (follow-up).  Ephemeral flag is ignored.
   * @param {string | import('discord.js').MessageCreateOptions} options
   * @returns {Promise<import('discord.js').Message>}
   */
  async followUp(options) {
    return this._message.channel.send(_buildPayload(options));
  }

  /**
   * "Defers" the reply by sending a placeholder that editReply() will later
   * replace.  This matches the slash-command deferred pattern used by commands
   * that do async work (e.g. API calls) before responding.
   *
   * @param {object} [_options]  Ignored (e.g. ephemeral flag)
   */
  async deferReply(_options) {
    this._sentReply = await this._message.channel.send({ content: '⏳' });
    this.deferred   = true;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strips interaction-only fields (flags, fetchReply) from an options object
 * so it can be passed directly to Message#send / Message#edit.
 *
 * @param {string | object} options
 * @returns {object}
 */
function _buildPayload(options) {
  if (typeof options === 'string') return { content: options };
  // eslint-disable-next-line no-unused-vars
  const { flags, fetchReply, ...rest } = options;
  return rest;
}

module.exports = { CommandContext };
