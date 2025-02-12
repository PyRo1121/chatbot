import logger from '../utils/logger.js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import AIService from '../utils/aiService.js';
import { ApiClient } from '@twurple/api';

class UnifiedModerationManager {
  constructor() {
    this.moderationData = this.loadModerationData();
    this.initializeData();
    this.initializeEscalationConfig();
    this.initializeSpamPatterns();
    this.aiService = new AIService();
    this.shadowbannedUsers = new Set();
    this.bannedWords = new Set();
    this.apiClient = null;
  }

  initializeApiClient(authProvider) {
    if (!authProvider) {
      logger.warn('Auth provider not supplied to UnifiedModerationManager');
      return;
    }
    this.apiClient = new ApiClient({ authProvider });
  }

  loadModerationData() {
    try {
      const data = readFileSync(join(process.cwd(), 'src/bot/moderation_data.json'), 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error loading moderation data:', error);
      return {
        warnings: {},
        trustedUsers: [],
        raidHistory: [],
        chatStats: {},
        spamPatterns: {},
        escalationLevels: {},
        settings: {
          enabled: true,
          minAccountAge: 7,
          followRateLimit: 10,
          escalationDecay: 86400, // 24 hours in seconds
        },
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

  initializeData() {
    if (!this.moderationData.warnings) {
      this.moderationData.warnings = {};
    }
    if (!this.moderationData.trustedUsers) {
      this.moderationData.trustedUsers = [];
    }
    if (!this.moderationData.raidHistory) {
      this.moderationData.raidHistory = [];
    }
    if (!this.moderationData.chatStats) {
      this.moderationData.chatStats = {};
    }
    if (!this.moderationData.spamPatterns) {
      this.moderationData.spamPatterns = {};
    }
    if (!this.moderationData.escalationLevels) {
      this.moderationData.escalationLevels = {};
    }
    if (!this.moderationData.settings) {
      this.moderationData.settings = {
        enabled: true,
        minAccountAge: 7,
        followRateLimit: 10,
        escalationDecay: 86400,
      };
    }
  }

  initializeEscalationConfig() {
    this.escalationConfig = {
      1: { duration: 5 * 60, action: 'warning' },
      2: { duration: 15 * 60, action: 'timeout' },
      3: { duration: 60 * 60, action: 'timeout' },
      4: { duration: 24 * 60 * 60, action: 'timeout' },
      5: { duration: -1, action: 'ban' },
    };
  }

  initializeSpamPatterns() {
    this.moderationData.spamPatterns = {
      repetition: { pattern: /(.)\1{9,}/, count: 0, severity: 0.5 },
      urls: { pattern: /(https?:\/\/[^\s]+)/g, count: 0, severity: 0.7 },
      capitals: { pattern: /[A-Z]{10,}/, count: 0, severity: 0.6 },
      emoteSpam: { pattern: /(\b\w+\b)(\s+\1){4,}/i, count: 0, severity: 0.5 },
    };
  }

  async moderateMessage(message, username, userLevel) {
    try {
      // Skip moderation for commands
      if (message.startsWith('!')) {
        return null;
      }
      
      // Skip moderation for trusted users and privileged roles
      if (this.moderationData.trustedUsers.includes(username) ||
          userLevel === 'mod' ||
          userLevel === 'vip' ||
          userLevel === 'broadcaster') {
        return null;
      }

      // Get user's current escalation level
      const escalation = this.moderationData.escalationLevels[username] || {
        level: 0,
        expires: null,
        history: [],
      };

      // Check if previous escalation has expired
      if (escalation.expires && Date.now() > escalation.expires) {
        escalation.level = Math.max(0, escalation.level - 1);
        escalation.expires = null;
      }

      // Perform AI analysis
      const analysis = await this.aiService.analyzeMessage(message, username);

      // Update chat stats (only for non-command messages)
      this.updateChatStats(username, message, analysis);

      // Check for violations
      const violations = await this.checkViolations(message, username, analysis);

      if (violations.length > 0) {
        // Increment escalation level
        escalation.level = Math.min(5, escalation.level + 1);

        // Get punishment for current level
        const punishment = this.escalationConfig[escalation.level];

        // Set expiration for temporary punishments
        if (punishment.duration > 0) {
          escalation.expires = Date.now() + punishment.duration * 1000;
        }

        // Record violation in history
        escalation.history.push({
          timestamp: Date.now(),
          violations,
          action: punishment.action,
          duration: punishment.duration,
        });

        // Update escalation data
        this.moderationData.escalationLevels[username] = escalation;

        // Return moderation action
        return {
          action: punishment.action,
          duration: punishment.duration,
          reason: violations.join(', '),
          level: escalation.level,
        };
      }

      return null;
    } catch (error) {
      logger.error('Error in unified moderation:', error);
      return null;
    }
  }

  calculateSimilarity(message, recentMessages) {
    if (!recentMessages.length) {
      return 0;
    }

    const words = message.toLowerCase().split(/\s+/);
    let maxSimilarity = 0;

    for (const recent of recentMessages) {
      const recentWords = recent.message.toLowerCase().split(/\s+/);
      const commonWords = words.filter((word) => recentWords.includes(word));
      const similarity = commonWords.length / Math.max(words.length, recentWords.length);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    return maxSimilarity;
  }

  async checkViolations(message, username, analysis) {
    const violations = [];

    // Add similarity check to existing checks
    const userStats = this.moderationData.chatStats[username];
    if (userStats) {
      const recentMessages = userStats.patterns.slice(-5);
      const similarityScore = this.calculateSimilarity(message, recentMessages);
      if (similarityScore > 0.8) {
        violations.push('Message spam (too similar)');
      }
    }

    // Check shadowban
    if (this.shadowbannedUsers.has(username.toLowerCase())) {
      violations.push('User is shadowbanned');
    }

    // Check banned words
    if (this.moderationData.bannedWords) {
      const containsBannedWord = this.moderationData.bannedWords.some(word =>
        message.toLowerCase().includes(word)
      );
      if (containsBannedWord) {
        violations.push('Contains banned word/phrase');
      }
    }

    // Check sentiment analysis
    if (analysis && analysis.sentiment > 0.8) {
      violations.push('Excessive toxicity');
    }

    // Check spam patterns
    for (const [name, data] of Object.entries(this.moderationData.spamPatterns)) {
      if (data.pattern.test(message)) {
        violations.push(`Detected ${name} spam`);
        // Update pattern statistics
        data.count++;
        data.lastSeen = Date.now();
        data.severity = Math.min(1, data.severity + 0.1);
        this.moderationData.spamPatterns[name] = data;
      }
    }

    return violations;
  }

  updateChatStats(username, message, analysis) {
    const stats = this.moderationData.chatStats[username] || {
      messages: 0,
      timeouts: 0,
      bans: 0,
      lastActive: null,
      patterns: [],
    };

    stats.messages++;
    stats.lastActive = Date.now();
    stats.patterns.push({
      message,
      timestamp: Date.now(),
      analysis,
    });

    // Keep only last 100 messages
    if (stats.patterns.length > 100) {
      stats.patterns.shift();
    }

    this.moderationData.chatStats[username] = stats;
  }

  async handleRaid(username, viewers) {
    try {
      // Analyze raid for suspicious patterns
      const suspicious = this.isRaidSuspicious(viewers);

      // Track raid
      this.moderationData.raidHistory.push({
        username,
        viewers,
        timestamp: Date.now(),
        suspicious,
      });

      // Keep only last 100 raids
      if (this.moderationData.raidHistory.length > 100) {
        this.moderationData.raidHistory.shift();
      }

      // Return raid analysis
      return {
        suspicious,
        action: suspicious ? 'monitor' : 'welcome',
        recommendedAction: suspicious ? 'Enable follower-only mode temporarily' : null,
      };
    } catch (error) {
      logger.error('Error handling raid:', error);
      return null;
    }
  }

  isRaidSuspicious(viewers) {
    const recentRaids = this.moderationData.raidHistory.slice(-10);
    const averageViewers =
      recentRaids.reduce((sum, raid) => sum + raid.viewers, 0) / recentRaids.length || 0;
    const viewerRatio = viewers / (averageViewers || viewers);
    return viewerRatio > 10;
  }

  getModStats() {
    const stats = {
      warnings: Object.values(this.moderationData.warnings).flat().length,
      trustedUsers: this.moderationData.trustedUsers.length,
      activeEscalations: Object.values(this.moderationData.escalationLevels).filter(
        (data) => data.expires && data.expires > Date.now()
      ).length,
      spamPatterns: Object.entries(this.moderationData.spamPatterns).map(([name, data]) => ({
        name,
        count: data.count,
        severity: data.severity,
      })),
    };

    return stats;
  }

  cleanup() {
    const now = Date.now();
    const ONE_HOUR = 3600000;

    // Cleanup expired escalations
    for (const [username, data] of Object.entries(this.moderationData.escalationLevels)) {
      if (data.expires && now > data.expires) {
        data.level = Math.max(0, data.level - 1);
        data.expires = null;
        this.moderationData.escalationLevels[username] = data;
      }
    }

    // Reset spam pattern severities periodically
    for (const [name, data] of Object.entries(this.moderationData.spamPatterns)) {
      if (data.lastSeen && now - data.lastSeen > ONE_HOUR) {
        data.severity = Math.max(0.5, data.severity - 0.2);
        this.moderationData.spamPatterns[name] = data;
      }
    }

    // Save updated data
    this.saveModerationData();
  }

  async trustUser(username) {
    try {
      // Clean up username: remove @ symbol, trim spaces, convert to lowercase
      const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
      
      logger.info(`Attempting to trust user: ${cleanUsername}`);

      if (!this.moderationData.trustedUsers) {
        this.moderationData.trustedUsers = [];
      }

      if (this.moderationData.trustedUsers.includes(cleanUsername)) {
        logger.info(`${cleanUsername} is already trusted`);
        return {
          success: false,
          message: `${cleanUsername} is already trusted!`,
        };
      }

      // Make sure we're not adding empty strings
      if (!cleanUsername) {
        return {
          success: false,
          message: 'Invalid username provided.',
        };
      }

      this.moderationData.trustedUsers = [...this.moderationData.trustedUsers, cleanUsername];
      this.saveModerationData();

      logger.info(`Updated trusted users: ${this.moderationData.trustedUsers.join(', ')}`);
      return {
        success: true,
        message: `${cleanUsername} has been added to trusted users.`,
      };
    } catch (error) {
      logger.error('Error trusting user:', error);
      return {
        success: false,
        message: 'Error trusting user.',
      };
    }
  }

  async untrustUser(username) {
    try {
      const cleanUsername = username.replace(/^@/, '').toLowerCase();

      if (!this.moderationData.trustedUsers) {
        this.moderationData.trustedUsers = [];
      }

      const index = this.moderationData.trustedUsers.indexOf(cleanUsername);
      if (index === -1) {
        return {
          success: false,
          message: `${cleanUsername} is not a trusted user!`,
        };
      }

      this.moderationData.trustedUsers.splice(index, 1);
      this.saveModerationData();
      return {
        success: true,
        message: `${cleanUsername} has been removed from trusted users.`,
      };
    } catch (error) {
      logger.error('Error untrusting user:', error);
      return {
        success: false,
        message: 'Error untrusting user.',
      };
    }
  }

  async handleModStats() {
    try {
      const stats = this.getModStats();
      return `Moderation Stats: Warnings: ${stats.warnings} | Trusted Users: ${stats.trustedUsers} | Active Escalations: ${stats.activeEscalations}`;
    } catch (error) {
      logger.error('Error getting mod stats:', error);
      return 'Error retrieving moderation stats.';
    }
  }

  async handleUserHistory(username) {
    try {
      const stats = this.moderationData.chatStats[username];
      if (!stats) {
        return `No history found for ${username}`;
      }
      return `${username}'s History: Messages: ${stats.messages} | Timeouts: ${stats.timeouts} | Bans: ${stats.bans} | Last Active: ${new Date(stats.lastActive).toLocaleString()}`;
    } catch (error) {
      logger.error('Error getting user history:', error);
      return 'Error retrieving user history.';
    }
  }

  async handleWarn(username, reason) {
    try {
      if (!this.moderationData.warnings[username]) {
        this.moderationData.warnings[username] = [];
      }
      this.moderationData.warnings[username].push({
        timestamp: Date.now(),
        reason,
      });
      this.saveModerationData();
      return `Warning issued to ${username}: ${reason}`;
    } catch (error) {
      logger.error('Error warning user:', error);
      return 'Error issuing warning.';
    }
  }

  async handleRaidHistory() {
    try {
      const raids = this.moderationData.raidHistory.slice(-5);
      if (raids.length === 0) {
        return 'No raid history available.';
      }
      const raidInfo = raids.map(r =>
        `${r.username}(${r.viewers})${r.suspicious ? '⚠️' : ''}`
      ).join(', ');
      return `Recent Raids: ${raidInfo}`;
    } catch (error) {
      logger.error('Error getting raid history:', error);
      return 'Error retrieving raid history.';
    }
  }

  async handleAnalyzeChat() {
    try {
      const stats = Object.values(this.moderationData.chatStats);
      const analysis = {
        activeUsers: stats.filter(s => Date.now() - s.lastActive < 3600000).length,
        totalMessages: stats.reduce((sum, s) => sum + s.messages, 0),
        warningRate: (Object.values(this.moderationData.warnings).flat().length / stats.length) || 0,
      };
      return `Chat Analysis: ${analysis.activeUsers} active users | ${analysis.totalMessages} total messages | ${(analysis.warningRate * 100).toFixed(1)}% warning rate`;
    } catch (error) {
      logger.error('Error analyzing chat:', error);
      return 'Error analyzing chat.';
    }
  }

  async getAccountAge(username) {
    try {
      if (!this.apiClient) {
        logger.warn('API client not initialized in UnifiedModerationManager');
        return 30; // Fallback if no API client
      }

      const user = await this.apiClient.users.getUserByName(username);
      if (!user) {
        throw new Error('User not found');
      }

      const createdAt = user.creationDate;
      const now = new Date();
      const ageInDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

      return ageInDays;
    } catch (error) {
      logger.error('Error getting account age:', error);
      return 30; // Fallback to 30 days if API call fails
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

  addBannedWord(word) {
    if (!this.moderationData.bannedWords) {
      this.moderationData.bannedWords = [];
    }
    if (!this.moderationData.bannedWords.includes(word.toLowerCase())) {
      this.moderationData.bannedWords.push(word.toLowerCase());
      this.saveModerationData();
      return true;
    }
    return false;
  }

  removeBannedWord(word) {
    if (!this.moderationData.bannedWords) {
      return false;
    }

    const index = this.moderationData.bannedWords.indexOf(word.toLowerCase());
    if (index !== -1) {
      this.moderationData.bannedWords.splice(index, 1);
      this.saveModerationData();
      return true;
    }
    return false;
  }

  async assessRaid(raider, viewers) {
    try {
      // Skip assessment for trusted raiders
      if (this.moderationData.trustedUsers.includes(raider.toLowerCase())) {
        return { safe: true };
      }

      const suspicious = [];

      // Check unusually high viewer count
      if (viewers > 1000) {
        suspicious.push('Unusually high viewer count');
      }

      // Check raider account age
      const accountAge = await this.getAccountAge(raider);
      if (accountAge < 7) {
        suspicious.push('New account');
      }

      // Check raid frequency
      const recentRaids = this.moderationData.raidHistory.filter(
        raid => raid.username.toLowerCase() === raider.toLowerCase() &&
        Date.now() - new Date(raid.timestamp).getTime() < 24 * 60 * 60 * 1000
      );

      if (recentRaids.length > 2) {
        suspicious.push('Multiple raids in 24 hours');
      }

      return {
        safe: suspicious.length === 0,
        reasons: suspicious,
      };
    } catch (error) {
      logger.error('Error assessing raid:', error);
      return { safe: true }; // Default to safe if assessment fails
    }
  }

  async handleTrusted() {
    try {
      if (!this.moderationData.trustedUsers || this.moderationData.trustedUsers.length === 0) {
        return 'No trusted users found.';
      }
      return `Trusted Users: ${this.moderationData.trustedUsers.join(', ')}`;
    } catch (error) {
      logger.error('Error getting trusted users:', error);
      return 'Error retrieving trusted users list.';
    }
  }
}

const unifiedModerationManager = new UnifiedModerationManager();
export default unifiedModerationManager;