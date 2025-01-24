import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import logger from '../utils/logger.js';
import { generateResponse } from '../utils/openai.js';

class ModerationManager {
  constructor() {
    this.dbPath = join(process.cwd(), 'src/bot/moderation_data.json');
    this.data = this.loadData();
    this.MESSAGE_HISTORY = 100; // Number of messages to keep for pattern detection
    this.SPAM_THRESHOLD = 0.7; // Confidence threshold for spam detection
    this.RAID_QUALITY_THRESHOLD = 0.6; // Threshold for raid quality assessment
    this.messageQueue = [];
    this.userMessageCounts = new Map();
    this.userFirstMessage = new Map();
    this.suspiciousPatterns = new Set();
  }

  loadData() {
    try {
      if (existsSync(this.dbPath)) {
        const data = readFileSync(this.dbPath, 'utf8');
        return JSON.parse(data);
      }
      const defaultData = {
        spamPatterns: [],
        bannedWords: [],
        userWarnings: {},
        raidHistory: [],
        moderationActions: [],
        trustedUsers: [],
        spamStats: {
          detectedSpam: 0,
          falsePositives: 0,
          successfulRaids: 0,
          blockedRaids: 0,
        },
      };
      this.saveData(defaultData);
      return defaultData;
    } catch (error) {
      logger.error('Error loading moderation data:', error);
      return {
        spamPatterns: [],
        bannedWords: [],
        userWarnings: {},
        raidHistory: [],
        moderationActions: [],
        trustedUsers: [],
        spamStats: {
          detectedSpam: 0,
          falsePositives: 0,
          successfulRaids: 0,
          blockedRaids: 0,
        },
      };
    }
  }

  saveData(data = this.data) {
    try {
      writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error('Error saving moderation data:', error);
    }
  }

  async analyzeMessage(message, username, userLevel) {
    try {
      // Update message history
      this.messageQueue.push({ message, username, timestamp: Date.now() });
      if (this.messageQueue.length > this.MESSAGE_HISTORY) {
        this.messageQueue.shift();
      }

      // Update user message counts
      this.userMessageCounts.set(username, (this.userMessageCounts.get(username) || 0) + 1);
      if (!this.userFirstMessage.has(username)) {
        this.userFirstMessage.set(username, Date.now());
      }

      // Skip trusted users and moderators
      if (
        userLevel === 'mod' ||
        userLevel === 'broadcaster' ||
        this.data.trustedUsers.includes(username)
      ) {
        return { isSpam: false, confidence: 0, action: 'none' };
      }

      const prompt = `Analyze this chat message for spam or inappropriate content:
Message: "${message}"
Username: ${username}
Message Count: ${this.userMessageCounts.get(username)}
Account Age: ${Date.now() - this.userFirstMessage.get(username)}ms

Recent chat context:
${this.messageQueue
  .slice(-5)
  .map((m) => `${m.username}: ${m.message}`)
  .join('\n')}

Respond with JSON only:
{
  "isSpam": boolean,
  "confidence": number (0-1),
  "type": "string (spam|inappropriate|excessive|normal)",
  "patterns": ["array of detected patterns"],
  "action": "string (none|warning|timeout|ban)",
  "reason": "string (explanation)"
}`;

      const response = await generateResponse(prompt);
      // Remove any markdown formatting and extract just the JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }
      const analysis = JSON.parse(jsonMatch[0]);

      // Update spam patterns if high confidence spam detected
      if (analysis.isSpam && analysis.confidence > this.SPAM_THRESHOLD) {
        analysis.patterns.forEach((pattern) => {
          if (!this.data.spamPatterns.includes(pattern)) {
            this.data.spamPatterns.push(pattern);
          }
        });
        this.data.spamStats.detectedSpam++;
        this.saveData();
      }

      return analysis;
    } catch (error) {
      logger.error('Error analyzing message:', error);
      return { isSpam: false, confidence: 0, action: 'none' };
    }
  }

  async assessRaidQuality(raider, viewers, raidHistory) {
    try {
      const prompt = `Assess the quality of this raid:
Raider: ${raider}
Viewers: ${viewers}
Raid History: ${JSON.stringify(raidHistory)}

Consider:
1. Previous raid patterns
2. Viewer count patterns
3. Timing and frequency
4. Known raid botting patterns

Respond with JSON only:
{
  "isSuspicious": boolean,
  "confidence": number (0-1),
  "risk": "string (low|medium|high)",
  "patterns": ["array of suspicious patterns"],
  "action": "string (allow|monitor|block)",
  "reason": "string (explanation)"
}`;

      const response = await generateResponse(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }
      const assessment = JSON.parse(jsonMatch[0]);

      // Record raid assessment
      this.data.raidHistory.push({
        raider,
        viewers,
        timestamp: new Date().toISOString(),
        assessment,
      });

      // Update stats
      if (assessment.action === 'allow') {
        this.data.spamStats.successfulRaids++;
      } else if (assessment.action === 'block') {
        this.data.spamStats.blockedRaids++;
      }

      this.saveData();
      return assessment;
    } catch (error) {
      logger.error('Error assessing raid:', error);
      return {
        isSuspicious: false,
        confidence: 0,
        risk: 'low',
        action: 'allow',
      };
    }
  }

  async detectSpamPattern(timeframe = 60000) {
    const recentMessages = this.messageQueue.filter(
      (msg) => Date.now() - msg.timestamp < timeframe
    );

    if (recentMessages.length < 3) {
      return null;
    }

    try {
      const prompt = `Analyze these chat messages for spam patterns:
Messages: ${JSON.stringify(recentMessages)}

Consider:
1. Message frequency per user
2. Content similarity
3. Known spam patterns
4. Timing patterns

Respond with JSON only:
{
  "hasPattern": boolean,
  "confidence": number (0-1),
  "patterns": ["array of detected patterns"],
  "involvedUsers": ["array of usernames"],
  "recommendedAction": "string (none|warn|timeout|ban)"
}`;

      const response = await generateResponse(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }
      const analysis = JSON.parse(jsonMatch[0]);

      if (analysis.hasPattern && analysis.confidence > this.SPAM_THRESHOLD) {
        analysis.patterns.forEach((pattern) => this.suspiciousPatterns.add(pattern));
      }

      return analysis;
    } catch (error) {
      logger.error('Error detecting spam pattern:', error);
      return null;
    }
  }

  warnUser(username, reason) {
    if (!this.data.userWarnings[username]) {
      this.data.userWarnings[username] = [];
    }

    this.data.userWarnings[username].push({
      timestamp: new Date().toISOString(),
      reason,
    });

    this.data.moderationActions.push({
      type: 'warning',
      username,
      reason,
      timestamp: new Date().toISOString(),
    });

    this.saveData();
    return this.data.userWarnings[username].length;
  }

  addTrustedUser(username) {
    if (!this.data.trustedUsers.includes(username)) {
      this.data.trustedUsers.push(username);
      this.saveData();
    }
  }

  removeTrustedUser(username) {
    const index = this.data.trustedUsers.indexOf(username);
    if (index !== -1) {
      this.data.trustedUsers.splice(index, 1);
      this.saveData();
    }
  }

  getModerationStats() {
    const warningsByUser = Object.entries(this.data.userWarnings).map(([user, warnings]) => ({
      username: user,
      count: warnings.length,
      lastWarning: warnings[warnings.length - 1],
    }));

    const recentActions = this.data.moderationActions
      .slice(-10)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
      spamStats: this.data.spamStats,
      activePatterns: Array.from(this.suspiciousPatterns),
      warningsByUser: warningsByUser.sort((a, b) => b.count - a.count),
      recentActions,
      trustedUsers: this.data.trustedUsers.length,
    };
  }

  getRecentRaids(limit = 10) {
    return this.data.raidHistory
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  getUserHistory(username) {
    return {
      warnings: this.data.userWarnings[username] || [],
      messageCount: this.userMessageCounts.get(username) || 0,
      firstSeen: this.userFirstMessage.get(username),
      isTrusted: this.data.trustedUsers.includes(username),
    };
  }
}

const moderationManager = new ModerationManager();
export default moderationManager;
