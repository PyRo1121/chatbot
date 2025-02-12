import logger from '../utils/logger.js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import AIService from '../utils/aiService.js';

class UnifiedModerationManager {
  constructor() {
    this.moderationData = this.loadModerationData();
    this.initializeData();
    this.initializeEscalationConfig();
    this.initializeSpamPatterns();
    this.aiService = new AIService();
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
      // Skip moderation for trusted users and mods
      if (this.moderationData.trustedUsers.includes(username) || userLevel === 'mod') {
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

      // Update chat stats
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

  async checkViolations(message, username, analysis) {
    const violations = [];

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
}

const unifiedModerationManager = new UnifiedModerationManager();
export default unifiedModerationManager;
