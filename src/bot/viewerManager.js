import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import logger from '../utils/logger.js';
import { generateResponse } from '../utils/gemini.js';
import getClient from './twitchClient.js';

class ViewerManager {
  constructor() {
    this.dbPath = join(process.cwd(), 'src/bot/viewer_data.json');
    this.data = this.loadData();
    this.LOYALTY_LEVELS = {
      NEW: { minVisits: 1, minPoints: 0, title: 'New Friend' },
      REGULAR: { minVisits: 50, minPoints: 1000, title: 'Regular' },
      LOYAL: { minVisits: 150, minPoints: 5000, title: 'Loyal Viewer' },
      DEDICATED: { minVisits: 300, minPoints: 15000, title: 'Dedicated Fan' },
      VETERAN: { minVisits: 500, minPoints: 50000, title: 'Stream Veteran' },
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

    Object.entries(this.data.viewers).forEach(([username, viewer]) => {
      const level = this.getLoyaltyLevel(viewer.visits, username);
      distribution[level.title]++;
    });

    this.data.viewerStats.loyaltyDistribution = distribution;
    this.data.viewerStats.returningRate = this.calculateReturningRate();
  }

  calculateReturningRate() {
    const returningViewers = Object.values(this.data.viewers).filter((v) => v.visits > 1).length;
    return returningViewers / this.data.viewerStats.totalUnique || 0;
  }

  getLoyaltyLevel(visits, username) {
    const levels = Object.entries(this.LOYALTY_LEVELS).reverse();
    const points = this.data.viewers[username]?.points || 0;

    for (const [, level] of levels) {
      if (visits >= level.minVisits && points >= level.minPoints) {
        return level;
      }
    }
    return this.LOYALTY_LEVELS.NEW;
  }

  checkLoyaltyMilestone(username) {
    const viewer = this.data.viewers[username];
    const currentLevel = this.getLoyaltyLevel(viewer.visits, username);

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
          level: this.getLoyaltyLevel(data.visits, username).title,
        })),
    };
  }

  addPoints(username, points) {
    if (!this.data.viewers[username]) {
      this.trackViewer(username);
    }

    if (!this.data.viewers[username].points) {
      this.data.viewers[username].points = 0;
    }

    this.data.viewers[username].points += points;
    this.saveData();
    return this.data.viewers[username].points;
  }

  async generateShoutout(username) {
    try {
      const client = await getClient();
      // Get user info from Twitch API
      const user = await client.twitchApi.users.getUserByName(username);

      if (!user) {
        return `Check out @${username}! They're awesome!`;
      }

      // Get channel info
      const channel = await client.twitchApi.channels.getChannelInfoById(user.id);

      // Create personalized message
      let message = `Check out @${user.displayName} (${user.name})! `;
      message += `They're a ${user.broadcasterType || 'viewer'} `;

      if (channel?.gameName) {
        message += `who streams ${channel.gameName} `;
      }

      if (channel?.title) {
        message += `with the tagline: "${channel.title}". `;
      } else {
        message += 'with great content! ';
      }

      message += `Give them a follow at https://twitch.tv/${user.name} !`;

      return message;
    } catch (error) {
      logger.error('Error generating shoutout:', error);
      return `Check out @${username}! They're awesome!`;
    }
  }
  getViewerHistorySummary(username) {
    const viewer = this.data.viewers[username];
    if (!viewer) {
      return null;
    }

    const level = this.getLoyaltyLevel(viewer.visits, username);
    const summary = [];
    summary.push(`${username} is a ${level.title} here`);
    summary.push(
      `They first visited on ${viewer.firstSeen.slice(0, 10)} and have visited ${viewer.visits} times`
    );

    if (viewer.milestones.length > 0) {
      const lastMilestone = viewer.milestones[viewer.milestones.length - 1];
      summary.push(
        `Last milestone achieved: ${lastMilestone.level} on ${lastMilestone.achievedAt.slice(0, 10)}`
      );
    }

    return summary.join('. ');
  }
}

const viewerManager = new ViewerManager();
export const trackViewer = viewerManager.trackViewer.bind(viewerManager);
export { viewerManager as default, viewerManager };
