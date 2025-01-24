import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import logger from '../utils/logger.js';
import { generateResponse } from '../utils/openai.js';

class ViewerManager {
  constructor() {
    this.dbPath = join(process.cwd(), 'src/bot/viewer_data.json');
    this.data = this.loadData();
    this.LOYALTY_LEVELS = {
      NEW: { minVisits: 1, title: 'New Friend' },
      REGULAR: { minVisits: 5, title: 'Regular' },
      LOYAL: { minVisits: 15, title: 'Loyal Viewer' },
      DEDICATED: { minVisits: 30, title: 'Dedicated Fan' },
      VETERAN: { minVisits: 50, title: 'Stream Veteran' },
    };
  }

  loadData() {
    try {
      if (existsSync(this.dbPath)) {
        const data = readFileSync(this.dbPath, 'utf8');
        return JSON.parse(data);
      }
      const defaultData = {
        viewers: {},
        raids: [],
        milestones: [],
        viewerStats: {
          totalUnique: 0,
          returningRate: 0,
          loyaltyDistribution: {},
        },
      };
      this.saveData(defaultData);
      return defaultData;
    } catch (error) {
      logger.error('Error loading viewer data:', error);
      return {
        viewers: {},
        raids: [],
        milestones: [],
        viewerStats: {
          totalUnique: 0,
          returningRate: 0,
          loyaltyDistribution: {},
        },
      };
    }
  }

  saveData(data = this.data) {
    try {
      writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error('Error saving viewer data:', error);
    }
  }

  async handleRaid(raider, viewers) {
    try {
      // Record raid
      this.data.raids.push({
        raider,
        viewers,
        timestamp: new Date().toISOString(),
      });

      // Generate personalized welcome message
      const raidHistory = this.data.raids.filter((raid) => raid.raider === raider);
      const isReturnRaider = raidHistory.length > 1;

      const prompt = `Create a warm and engaging raid welcome message. Details:
- Raider: ${raider}
- Viewers: ${viewers}
- Times raided before: ${raidHistory.length - 1}
- Last raid: ${isReturnRaider ? raidHistory[raidHistory.length - 2].timestamp : 'First time'}

Keep it fun and personal! Message should be one short paragraph.`;

      const welcomeMessage = await generateResponse(prompt);
      this.saveData();

      return welcomeMessage;
    } catch (error) {
      logger.error('Error handling raid:', error);
      return `Welcome to the stream ${raider} and the ${viewers} raiders! Thank you for the raid! 🎉`;
    }
  }

  trackViewer(username) {
    if (!this.data.viewers[username]) {
      this.data.viewers[username] = {
        firstSeen: new Date().toISOString(),
        visits: 0,
        lastSeen: null,
        watchtime: 0,
        milestones: [],
      };
      this.data.viewerStats.totalUnique++;
    }

    const viewer = this.data.viewers[username];
    viewer.visits++;
    viewer.lastSeen = new Date().toISOString();

    // Update loyalty distribution
    this.updateLoyaltyStats();
    this.saveData();

    // Check for loyalty milestones
    return this.checkLoyaltyMilestone(username);
  }

  updateLoyaltyStats() {
    const distribution = {};
    Object.values(this.LOYALTY_LEVELS).forEach((level) => {
      distribution[level.title] = 0;
    });

    Object.values(this.data.viewers).forEach((viewer) => {
      const level = this.getLoyaltyLevel(viewer.visits);
      distribution[level.title]++;
    });

    this.data.viewerStats.loyaltyDistribution = distribution;
    this.data.viewerStats.returningRate = this.calculateReturningRate();
  }

  calculateReturningRate() {
    const returningViewers = Object.values(this.data.viewers).filter((v) => v.visits > 1).length;
    return returningViewers / this.data.viewerStats.totalUnique || 0;
  }

  getLoyaltyLevel(visits) {
    const levels = Object.entries(this.LOYALTY_LEVELS).reverse();
    for (const [, level] of levels) {
      if (visits >= level.minVisits) {
        return level;
      }
    }
    return this.LOYALTY_LEVELS.NEW;
  }

  checkLoyaltyMilestone(username) {
    const viewer = this.data.viewers[username];
    const currentLevel = this.getLoyaltyLevel(viewer.visits);

    // Check if this level was already achieved
    const existingMilestone = viewer.milestones.find((m) => m.level === currentLevel.title);
    if (!existingMilestone && currentLevel.title !== 'New Friend') {
      const milestone = {
        level: currentLevel.title,
        achievedAt: new Date().toISOString(),
        visits: viewer.visits,
      };
      viewer.milestones.push(milestone);
      this.saveData();

      return {
        username,
        newLevel: currentLevel.title,
        message: `🎉 Congratulations @${username} on becoming a ${currentLevel.title}! Thank you for being an awesome part of our community!`,
      };
    }
    return null;
  }

  getViewerStats() {
    return {
      totalUnique: this.data.viewerStats.totalUnique,
      returningRate: Math.round(this.data.viewerStats.returningRate * 100),
      loyaltyDistribution: this.data.viewerStats.loyaltyDistribution,
      recentRaids: this.data.raids.slice(-5),
      topViewers: Object.entries(this.data.viewers)
        .sort(([, a], [, b]) => b.visits - a.visits)
        .slice(0, 10)
        .map(([username, data]) => ({
          username,
          visits: data.visits,
          level: this.getLoyaltyLevel(data.visits).title,
        })),
    };
  }
}

const viewerManager = new ViewerManager();
export default viewerManager;
