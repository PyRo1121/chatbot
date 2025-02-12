import logger from '../utils/logger.js';

class CommandRegistry {
  constructor() {
    this.commands = new Map();
    this.cooldowns = new Map();
    this.globalCooldown = 1000; // 1 second global cooldown
  }

  register(
    commandName,
    {
      handler,
      permissions = ['everyone'],
      description = '',
      usage = '',
      cooldown = 0, // Cooldown in milliseconds
      rateLimit = { count: 0, window: 0 }, // Rate limit in count per window (milliseconds)
    }
  ) {
    this.commands.set(commandName.toLowerCase(), {
      handler,
      permissions,
      description,
      usage,
      cooldown,
      rateLimit,
      usageCount: new Map(), // Track usage for rate limiting
      lastUsed: new Map(), // Track last used time for cooldowns
    });
  }

  async execute(twitchClient, channel, user, command, args) {
    const commandName = command.toLowerCase();
    const commandInfo = this.commands.get(commandName);

    if (!commandInfo) {
      logger.debug(`Command not found: ${commandName}`);
      return null;
    }

    try {
      // Check permissions
      const userPermissions = this.getUserPermissions(user);
      if (!this.hasPermission(userPermissions, commandInfo.permissions)) {
        logger.debug(`User ${user.username} lacks permission for command: ${commandName}`);
        return null;
      }

      // Check global cooldown
      const now = Date.now();
      const globalLastUsed = this.cooldowns.get(user.username) || 0;
      if (now - globalLastUsed < this.globalCooldown) {
        logger.debug(`Global cooldown active for user ${user.username}`);
        return null;
      }

      // Check command-specific cooldown
      const lastUsed = commandInfo.lastUsed.get(user.username) || 0;
      if (commandInfo.cooldown > 0 && now - lastUsed < commandInfo.cooldown) {
        const remainingTime = Math.ceil((commandInfo.cooldown - (now - lastUsed)) / 1000);
        logger.debug(`Command cooldown active for ${user.username}: ${remainingTime}s remaining`);
        return `This command is on cooldown. Please wait ${remainingTime} seconds.`;
      }

      // Check rate limit
      if (commandInfo.rateLimit.count > 0) {
        const userUsage = commandInfo.usageCount.get(user.username) || [];
        const windowStart = now - commandInfo.rateLimit.window;
        const recentUsage = userUsage.filter((time) => time > windowStart);

        if (recentUsage.length >= commandInfo.rateLimit.count) {
          const oldestUsage = recentUsage[0];
          const resetTime = Math.ceil((oldestUsage + commandInfo.rateLimit.window - now) / 1000);
          logger.debug(`Rate limit exceeded for ${user.username} on ${commandName}`);
          return `You've used this command too many times. Please wait ${resetTime} seconds.`;
        }

        // Update usage count
        commandInfo.usageCount.set(user.username, [...recentUsage, now]);
      }

      // Update cooldowns
      this.cooldowns.set(user.username, now);
      commandInfo.lastUsed.set(user.username, now);

      // Execute command
      const response = await commandInfo.handler(twitchClient, channel, user, args);
      return response;
    } catch (error) {
      logger.error(`Error executing command ${commandName}:`, error);
      if (error.message.includes('rate limit') || error.message.includes('cooldown')) {
        return error.message;
      }
      return `Error executing command ${commandName}. Please try again later.`;
    }
  }

  getUserPermissions(user) {
    const permissions = ['everyone'];
    if (user.isMod) {
      permissions.push('mod');
    }
    if (user.isBroadcaster) {
      permissions.push('broadcaster');
    }
    return permissions;
  }

  hasPermission(userPermissions, requiredPermissions) {
    return requiredPermissions.some((permission) => userPermissions.includes(permission));
  }

  getCommands(userPermissions) {
    return Array.from(this.commands.entries())
      .filter(([_, info]) => this.hasPermission(userPermissions, info.permissions))
      .map(([name, info]) => ({
        name,
        description: info.description,
        usage: info.usage,
        cooldown: info.cooldown,
        rateLimit: info.rateLimit,
      }));
  }

  // Cleanup old rate limit data periodically
  cleanup() {
    const now = Date.now();
    for (const [commandName, commandInfo] of this.commands.entries()) {
      if (commandInfo.rateLimit.count > 0) {
        for (const [user, usage] of commandInfo.usageCount.entries()) {
          const windowStart = now - commandInfo.rateLimit.window;
          const recentUsage = usage.filter((time) => time > windowStart);
          if (recentUsage.length === 0) {
            commandInfo.usageCount.delete(user);
          } else {
            commandInfo.usageCount.set(user, recentUsage);
          }
        }
      }
    }
  }
}

export default new CommandRegistry();
