import { analyzeSentiment } from '../utils/deepseek.js';
import logger from '../utils/logger.js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

class AdvancedModeration {
  constructor() {
    this.moderationData = this.loadModerationData();
    this.shadowbannedUsers = new Set();
    this.spamPatterns = new Map();
    this.initializeSpamPatterns();
  }

  loadModerationData() {
    try {
      const data = readFileSync(join(process.cwd(), 'src/bot/moderation_data.json'), 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error loading moderation data:', error);
      return {
        spamPatterns: [],
        bannedWords: [],
        spamStats: {
          detectedSpam: 0,
          falsePositives: 0,
          lastUpdated: new Date().toISOString(),
        },
        stats: {
          timeouts: 0,
          bans: 0,
          warnings: 0,
          deletedMessages: 0,
        },
        userHistory: {},
        trustedUsers: [],
        raidHistory: [],
        chatAnalysis: {
          messagesPerMinute: 0,
          uniqueChatters: 0,
          emoteUsage: 0,
          spamDetected: 0,
        },
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  saveModerationData() {
    try {
      writeFileSync(
        join(process.cwd(), 'src/bot/moderation_data.json'),
        JSON.stringify(this.moderationData, null, 2)
      );
    } catch (error) {
      logger.error('Error saving moderation data:', error);
    }
  }

  initializeSpamPatterns() {
    // Basic spam patterns
    this.spamPatterns.set('repetition', /(.)\1{9,}/);
    this.spamPatterns.set('caps', /[A-Z]{10,}/);
    this.spamPatterns.set('urls', /(https?:\/\/[^\s]+[\w-]+\.[^\s]+)/g);
    this.spamPatterns.set('emotes', /(.{2,})\1{4,}/);
  }

  async analyzeMessage(message, user) {
    try {
      // Skip moderation for mods, VIPs, and !roast command
      if (user.mod || user.badges?.vip || message.toLowerCase().startsWith('!roast')) {
        return null;
      }

      // Check shadowban
      if (this.shadowbannedUsers.has(user.username.toLowerCase())) {
        return { action: 'shadowban' };
      }

      // Check spam patterns
      for (const [type, pattern] of this.spamPatterns) {
        if (pattern.test(message)) {
          this.moderationData.spamStats.detectedSpam++;
          return {
            action: 'timeout',
            duration: 300,
            reason: `Excessive ${type} detected`,
          };
        }
      }

      // Check banned words
      const containsBannedWord = this.moderationData.bannedWords.some((word) =>
        message.toLowerCase().includes(word.toLowerCase())
      );
      if (containsBannedWord) {
        return {
          action: 'timeout',
          duration: 600,
          reason: 'Banned word/phrase detected',
        };
      }

      // Analyze sentiment
      const sentiment = await analyzeSentiment(message);
      if (sentiment?.toxic) {
        return {
          action: 'warning',
          reason: 'Please keep chat friendly and positive!',
        };
      }

      // Save stats periodically
      if (this.moderationData.spamStats.detectedSpam % 10 === 0) {
        this.saveModerationData();
      }

      return null;
    } catch (error) {
      logger.error('Error analyzing message:', error);
      return null;
    }
  }

  async assessRaid(raider, viewers) {
    try {
      // Skip assessment for known good raiders
      if (this.moderationData.trustedRaiders?.includes(raider.toLowerCase())) {
        return { safe: true };
      }

      // Check for suspicious patterns
      const suspicious = [];

      // Unusually high viewer count
      if (viewers > 1000) {
        suspicious.push('Unusually high viewer count');
      }

      // Check raider account age
      const accountAge = await this.getAccountAge(raider);
      if (accountAge < 7) {
        // Less than 7 days old
        suspicious.push('New account');
      }

      // Check raid history
      const raidHistory = this.moderationData.raidHistory || [];
      const recentRaids = raidHistory.filter(
        (raid) =>
          raid.username.toLowerCase() === raider.toLowerCase() &&
          Date.now() - new Date(raid.timestamp).getTime() < 24 * 60 * 60 * 1000 // Last 24 hours
      );

      if (recentRaids.length > 2) {
        suspicious.push('Multiple raids in 24 hours');
      }

      // Add to raid history
      raidHistory.push({
        username: raider,
        viewers,
        timestamp: new Date().toISOString(),
      });
      this.moderationData.raidHistory = raidHistory;
      this.saveModerationData();

      return {
        safe: suspicious.length === 0,
        reasons: suspicious,
      };
    } catch (error) {
      logger.error('Error assessing raid:', error);
      return { safe: true }; // Default to safe if assessment fails
    }
  }

  async getAccountAge(username) {
    try {
      // This would normally call Twitch API to get account creation date using username
      // For now, return a default value
      const response = await Promise.resolve(30); // Simulate API call
      return response;
    } catch (error) {
      logger.error('Error getting account age:', error);
      return 0;
    }
  }

  getRaidHistory() {
    try {
      return this.moderationData.raidHistory || [];
    } catch (error) {
      logger.error('Error getting raid history:', error);
      return [];
    }
  }

  shadowbanUser(username) {
    this.shadowbannedUsers.add(username.toLowerCase());
    logger.info(`User shadowbanned: ${username}`);
  }

  unshadowbanUser(username) {
    const removed = this.shadowbannedUsers.delete(username.toLowerCase());
    if (removed) {
      logger.info(`User unshadowbanned: ${username}`);
    }
    return removed;
  }

  addSpamPattern(name, pattern) {
    try {
      const regex = new RegExp(pattern);
      this.spamPatterns.set(name, regex);
      this.moderationData.spamPatterns.push({ name, pattern });
      this.saveModerationData();
      return true;
    } catch (error) {
      logger.error('Error adding spam pattern:', error);
      return false;
    }
  }

  removeSpamPattern(name) {
    const removed = this.spamPatterns.delete(name);
    if (removed) {
      this.moderationData.spamPatterns = this.moderationData.spamPatterns.filter(
        (p) => p.name !== name
      );
      this.saveModerationData();
    }
    return removed;
  }

  addBannedWord(word) {
    if (!this.moderationData.bannedWords.includes(word.toLowerCase())) {
      this.moderationData.bannedWords.push(word.toLowerCase());
      this.saveModerationData();
      return true;
    }
    return false;
  }

  removeBannedWord(word) {
    const index = this.moderationData.bannedWords.indexOf(word.toLowerCase());
    if (index !== -1) {
      this.moderationData.bannedWords.splice(index, 1);
      this.saveModerationData();
      return true;
    }
    return false;
  }

  getStats() {
    return {
      spamDetected: this.moderationData.spamStats.detectedSpam,
      falsePositives: this.moderationData.spamStats.falsePositives,
      bannedWords: this.moderationData.bannedWords.length,
      spamPatterns: this.spamPatterns.size,
      shadowbannedUsers: this.shadowbannedUsers.size,
      lastUpdated: this.moderationData.spamStats.lastUpdated,
    };
  }

  async getUserHistory(username) {
    return this.moderationData.userHistory[username] || null;
  }

  async trustUser(username) {
    if (!this.moderationData.trustedUsers.includes(username)) {
      this.moderationData.trustedUsers.push(username);
      this.saveModerationData();
    }
  }

  async untrustUser(username) {
    this.moderationData.trustedUsers = this.moderationData.trustedUsers.filter(
      (u) => u !== username
    );
    this.saveModerationData();
  }

  async getChatAnalysis() {
    return this.moderationData.chatAnalysis;
  }

  async warnUser(username, reason) {
    if (!this.moderationData.userHistory[username]) {
      this.moderationData.userHistory[username] = {
        timeouts: 0,
        warnings: 0,
        lastAction: null,
      };
    }
    this.moderationData.userHistory[username].warnings++;
    this.moderationData.userHistory[username].lastAction = {
      type: 'warning',
      reason,
      timestamp: new Date().toISOString(),
    };
    this.moderationData.stats.warnings++;
    this.saveModerationData();
  }
}

// Export a single instance without manual bindings
export default new AdvancedModeration();
