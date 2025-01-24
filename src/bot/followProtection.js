import logger from '../utils/logger.js';

class FollowProtection {
  constructor() {
    this.followHistory = new Map(); // Store follow history by userId
    this.followRateWindow = new Map(); // Track follows within time windows
    this.suspiciousFollowers = new Map(); // Track suspicious followers
    this.silentMode = false;
    this.silentModeTimeout = null;

    // Configuration
    this.config = {
      minAccountAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
      maxFollowsPerMinute: 5,
      silentModeDuration: 5 * 60 * 1000, // 5 minutes in milliseconds
      rateWindowDuration: 60 * 1000, // 1 minute in milliseconds
    };
  }

  updateConfig(key, value) {
    if (!(key in this.config)) {
      throw new Error(`Invalid config key: ${key}`);
    }

    // Convert time-based values to milliseconds
    if (key === 'minAccountAge') {
      // Value is in hours
      this.config[key] = value * 60 * 60 * 1000;
    } else if (key === 'silentModeDuration') {
      // Value is in minutes
      this.config[key] = value * 60 * 1000;
    } else {
      this.config[key] = value;
    }

    logger.info(`Updated follow protection config: ${key} = ${value}`);
    return this.config[key];
  }

  getConfig() {
    return {
      minAccountAge: this.config.minAccountAge / (60 * 60 * 1000), // Convert to hours
      maxFollowsPerMinute: this.config.maxFollowsPerMinute,
      silentModeDuration: this.config.silentModeDuration / (60 * 1000), // Convert to minutes
      rateWindowDuration: this.config.rateWindowDuration,
    };
  }

  async isFollowSuspicious(event) {
    try {
      const { userId, userDisplayName, userLogin } = event;
      const now = Date.now();

      // Check follow rate
      this.updateFollowRate(now);
      if (this.isRateExceeded()) {
        logger.warn('Follow rate exceeded. Triggering silent mode.');
        this.enableSilentMode();
        return true;
      }

      // Check username patterns
      if (this.hasSuspiciousUsername(userLogin)) {
        logger.warn(`Suspicious username pattern detected: ${userLogin}`);
        return true;
      }

      // Check account age
      const accountAge = await this.getAccountAge(userId);
      if (accountAge < this.config.minAccountAge) {
        logger.warn(`New account detected: ${userDisplayName} (Age: ${accountAge}ms)`);
        return true;
      }

      // Track this follow
      this.followHistory.set(userId, {
        timestamp: now,
        username: userDisplayName,
      });

      // If any checks failed, add to suspicious followers
      if (
        this.isRateExceeded() ||
        this.hasSuspiciousUsername(userLogin) ||
        accountAge < this.config.minAccountAge
      ) {
        this.suspiciousFollowers.set(userId, {
          timestamp: now,
          username: userDisplayName,
          login: userLogin,
          reason: this.getSuspiciousReason(userLogin, accountAge),
          accountAge,
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error in follow protection:', error);
      return false; // Default to allowing follows if check fails
    }
  }

  updateFollowRate(now) {
    // Clean up old entries
    for (const [timestamp] of this.followRateWindow) {
      if (now - timestamp > this.config.rateWindowDuration) {
        this.followRateWindow.delete(timestamp);
      }
    }

    // Add new follow
    this.followRateWindow.set(now, true);
  }

  isRateExceeded() {
    return this.followRateWindow.size > this.config.maxFollowsPerMinute;
  }

  hasSuspiciousUsername(username) {
    // Check for common bot patterns
    const botPatterns = [
      /\d{8,}/, // Many numbers in sequence
      /[a-z]\d{4,}/, // Letter followed by many numbers
      /(.)\1{4,}/, // Repeated characters
      /[a-z]+\d+[a-z]+\d+/, // Alternating letters and numbers
    ];

    return botPatterns.some((pattern) => pattern.test(username.toLowerCase()));
  }

  async getAccountAge(userId) {
    try {
      // Get the Twitch client instance
      const twitchClient = await (await import('./twitchClient.js')).default();

      // Get user information from Twitch API
      const user = await twitchClient.twitchApi.users.getUserById(userId);
      if (!user) {
        logger.warn(`Could not find user with ID ${userId}`);
        return 0; // Treat as brand new account
      }

      // Calculate account age in milliseconds
      const creationDate = new Date(user.creationDate);
      const accountAge = Date.now() - creationDate.getTime();

      logger.info(
        `Account age for ${user.displayName}: ${accountAge}ms (created: ${creationDate.toISOString()})`
      );
      return accountAge;
    } catch (error) {
      logger.error('Error getting account age:', error);
      return Infinity; // Assume old account on error to avoid false positives
    }
  }

  enableSilentMode() {
    if (!this.silentMode) {
      this.silentMode = true;
      logger.info('Entering silent mode for follow announcements');

      // Clear existing timeout if any
      if (this.silentModeTimeout) {
        clearTimeout(this.silentModeTimeout);
      }

      // Set timeout to disable silent mode
      this.silentModeTimeout = setTimeout(() => {
        this.silentMode = false;
        this.followRateWindow.clear();
        logger.info('Exiting silent mode for follow announcements');
      }, this.config.silentModeDuration);
    }
  }

  isSilentMode() {
    return this.silentMode;
  }

  getSuspiciousReason(userLogin, accountAge) {
    if (this.isRateExceeded()) {
      return 'Follow rate exceeded';
    }
    if (this.hasSuspiciousUsername(userLogin)) {
      return 'Suspicious username pattern';
    }
    if (accountAge < this.config.minAccountAge) {
      return 'New account';
    }
    return 'Unknown';
  }

  async getSuspiciousFollowers() {
    const followers = Array.from(this.suspiciousFollowers.entries()).map(([userId, data]) => ({
      userId,
      ...data,
      timestamp: new Date(data.timestamp).toISOString(),
      accountAge: `${Math.round(data.accountAge / (1000 * 60 * 60))} hours`,
    }));

    return followers.sort((a, b) => b.timestamp - a.timestamp);
  }

  clearSuspiciousFollowers() {
    const count = this.suspiciousFollowers.size;
    this.suspiciousFollowers.clear();
    return count;
  }
}

// Export singleton instance
export default new FollowProtection();
