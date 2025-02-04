import logger from '../utils/logger.js';
import aiService from '../utils/aiService.js';

class SmartModerationManager {
  constructor() {
    this.moderationData = {
      warnings: new Map(), // username -> [{timestamp, reason, level}]
      trustedUsers: new Set(),
      raidHistory: [], // [{username, viewers, timestamp, suspicious, analysis}]
      chatStats: new Map(), // username -> {messages, timeouts, bans, lastActive, patterns}
      spamPatterns: new Map(), // pattern -> {count, lastSeen, severity}
      escalationLevels: new Map(), // username -> {level, expires, history}
    };

    // Define escalation levels
    this.escalationConfig = {
      1: { duration: 5 * 60, action: 'warning' }, // 5 minutes
      2: { duration: 15 * 60, action: 'timeout' }, // 15 minutes
      3: { duration: 60 * 60, action: 'timeout' }, // 1 hour
      4: { duration: 24 * 60 * 60, action: 'timeout' }, // 24 hours
      5: { duration: -1, action: 'ban' }, // Permanent ban
    };

    // Initialize spam detection patterns
    this.initializeSpamPatterns();
  }

  initializeSpamPatterns() {
    // Base patterns for spam detection
    const commonPatterns = {
      repetition: /(.)\1{9,}/,
      urls: /(https?:\/\/[^\s]+)/g,
      capitals: /[A-Z]{10,}/,
      emoteSpam: /(\b\w+\b)(\s+\1){4,}/i,
    };

    for (const [name, pattern] of Object.entries(commonPatterns)) {
      this.spamPatterns.set(name, {
        pattern,
        count: 0,
        lastSeen: null,
        severity: 0.5,
      });
    }
  }

  async moderateMessage(message, username, userLevel) {
    try {
      // Skip moderation for trusted users and mods
      if (this.moderationData.trustedUsers.has(username) || userLevel === 'mod') {
        return null;
      }

      // Get user's current escalation level
      const escalation = this.moderationData.escalationLevels.get(username) || {
        level: 0,
        expires: null,
        history: [],
      };

      // Check if previous escalation has expired
      if (escalation.expires && Date.now() > escalation.expires) {
        escalation.level = Math.max(0, escalation.level - 1); // Reduce level by 1
        escalation.expires = null;
      }

      // Perform AI analysis
      const analysis = await aiService.analyzeMessage(message, username);

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
        this.moderationData.escalationLevels.set(username, escalation);

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
      logger.error('Error in smart moderation:', error);
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
    for (const [name, data] of this.spamPatterns.entries()) {
      if (data.pattern.test(message)) {
        violations.push(`Detected ${name} spam`);
        // Update pattern statistics
        data.count++;
        data.lastSeen = Date.now();
        data.severity = Math.min(1, data.severity + 0.1);
        this.spamPatterns.set(name, data);
      }
    }

    // Check user's recent history
    const userStats = this.moderationData.chatStats.get(username);
    if (userStats) {
      const recentMessages = userStats.patterns.slice(-5);
      const similarityScore = this.calculateSimilarity(message, recentMessages);
      if (similarityScore > 0.8) {
        violations.push('Message spam');
      }
    }

    return violations;
  }

  updateChatStats(username, message, analysis) {
    const stats = this.moderationData.chatStats.get(username) || {
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

    this.moderationData.chatStats.set(username, stats);
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
    // Analyze raid patterns
    const recentRaids = this.moderationData.raidHistory.slice(-10);

    // Check for unusual viewer counts
    const averageViewers =
      recentRaids.reduce((sum, raid) => sum + raid.viewers, 0) / recentRaids.length || 0;
    const viewerRatio = viewers / (averageViewers || viewers);

    return viewerRatio > 10; // Suspicious if 10x more than average
  }

  getModStats() {
    const stats = {
      warnings: Array.from(this.moderationData.warnings.values()).flat().length,
      trustedUsers: this.moderationData.trustedUsers.size,
      activeEscalations: Array.from(this.moderationData.escalationLevels.entries()).filter(
        ([_, data]) => data.expires && data.expires > Date.now()
      ).length,
      spamPatterns: Array.from(this.spamPatterns.entries()).map(([name, data]) => ({
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
    for (const [username, data] of this.moderationData.escalationLevels.entries()) {
      if (data.expires && now > data.expires) {
        data.level = Math.max(0, data.level - 1);
        data.expires = null;
        this.moderationData.escalationLevels.set(username, data);
      }
    }

    // Reset spam pattern severities periodically
    for (const [name, data] of this.spamPatterns.entries()) {
      if (data.lastSeen && now - data.lastSeen > ONE_HOUR) {
        data.severity = Math.max(0.5, data.severity - 0.2);
        this.spamPatterns.set(name, data);
      }
    }
  }
}

const smartModerationManager = new SmartModerationManager();
export default smartModerationManager;
