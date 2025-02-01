import logger from '../utils/logger.js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

class FollowProtection {
  constructor() {
    this.protectionData = this.loadProtectionData();
    this.initializeData();
  }

  loadProtectionData() {
    try {
      const data = readFileSync(
        join(process.cwd(), 'src/bot/moderation_data.json'),
        'utf8'
      );
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error loading follow protection data:', error);
      return {
        settings: {
          enabled: true,
          minAccountAge: 7, // days
          followRateLimit: 10, // follows per hour
        },
        suspiciousFollowers: [],
        followMode: {
          enabled: false,
          type: 'followers',
          duration: 300,
        },
        stats: {
          suspicious: 0,
          blocked: 0,
          falsePositives: 0,
          totalFollows: 0,
          lastUpdated: new Date().toISOString(),
        },
      };
    }
  }

  saveProtectionData() {
    try {
      writeFileSync(
        join(process.cwd(), 'src/bot/moderation_data.json'),
        JSON.stringify(this.protectionData, null, 2)
      );
    } catch (error) {
      logger.error('Error saving follow protection data:', error);
    }
  }

  initializeData() {
    if (!this.protectionData.settings) {
      this.protectionData.settings = {
        enabled: true,
        minAccountAge: 7,
        followRateLimit: 10,
      };
    }
    if (!this.protectionData.suspiciousFollowers) {
      this.protectionData.suspiciousFollowers = [];
    }
    if (!this.protectionData.followMode) {
      this.protectionData.followMode = {
        enabled: false,
        type: 'followers',
        duration: 300,
      };
    }
    if (!this.protectionData.stats) {
      this.protectionData.stats = {
        suspicious: 0,
        blocked: 0,
        falsePositives: 0,
        totalFollows: 0,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  async checkFollower(username, accountAge, followCount) {
    try {
      if (!this.protectionData.settings.enabled) {
        return { suspicious: false };
      }

      const reasons = [];

      // Check account age
      if (accountAge < this.protectionData.settings.minAccountAge) {
        reasons.push(
          `Account age (${accountAge}d) below minimum (${this.protectionData.settings.minAccountAge}d)`
        );
      }

      // Check follow rate
      if (followCount > this.protectionData.settings.followRateLimit) {
        reasons.push(
          `Follow rate (${followCount}/h) exceeds limit (${this.protectionData.settings.followRateLimit}/h)`
        );
      }

      // Check if already marked as suspicious
      const existingSuspicious = this.protectionData.suspiciousFollowers.find(
        (f) => f.username.toLowerCase() === username.toLowerCase()
      );

      if (existingSuspicious) {
        reasons.push(
          `Previously marked as suspicious: ${existingSuspicious.reason}`
        );
      }

      if (reasons.length > 0) {
        this.protectionData.stats.suspicious++;
        this.protectionData.suspiciousFollowers.push({
          username,
          reason: reasons.join(', '),
          timestamp: new Date().toISOString(),
        });
        this.saveProtectionData();
        return { suspicious: true, reason: reasons.join(', ') };
      }

      return { suspicious: false };
    } catch (error) {
      logger.error('Error checking follower:', error);
      return { suspicious: false };
    }
  }

  async getSuspiciousFollowers() {
    return this.protectionData.suspiciousFollowers;
  }

  async clearSuspiciousFollowers() {
    const count = this.protectionData.suspiciousFollowers.length;
    this.protectionData.suspiciousFollowers = [];
    this.saveProtectionData();
    return count;
  }

  async updateSettings(settings) {
    this.protectionData.settings = {
      ...this.protectionData.settings,
      ...settings,
    };
    this.saveProtectionData();
    return this.protectionData.settings;
  }

  getSettings() {
    return this.protectionData.settings;
  }

  async setFollowMode(mode) {
    this.protectionData.followMode = {
      ...this.protectionData.followMode,
      ...mode,
    };
    this.saveProtectionData();
    return this.protectionData.followMode;
  }

  getFollowMode() {
    return this.protectionData.followMode;
  }

  getStats() {
    return this.protectionData.stats;
  }

  cleanup() {
    try {
      // Keep only last 30 days of suspicious followers
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      this.protectionData.suspiciousFollowers =
        this.protectionData.suspiciousFollowers.filter(
          (follower) => new Date(follower.timestamp) > thirtyDaysAgo
        );

      // Reset stats
      this.protectionData.stats = {
        suspicious: this.protectionData.suspiciousFollowers.length,
        blocked: 0,
        falsePositives: 0,
        totalFollows: 0,
        lastUpdated: new Date().toISOString(),
      };

      this.saveProtectionData();
      logger.info('Follow protection data cleaned up');
      return true;
    } catch (error) {
      logger.error('Error cleaning up follow protection data:', error);
      return false;
    }
  }
}

export default new FollowProtection();
