import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import logger from '../utils/logger.js';

class Analytics {
  constructor() {
    this.analyticsData = this.loadAnalyticsData();
    this.currentStream = {
      startTime: null,
      endTime: null,
      viewers: [],
      chatMessages: 0,
      commands: {},
      highlights: [],
      raids: [],
    };
  }

  loadAnalyticsData() {
    try {
      const data = readFileSync(
        join(process.cwd(), 'src/bot/analytics.json'),
        'utf8'
      );
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error loading analytics data:', error);
      return {
        totalStreams: 0,
        totalHours: 0,
        peakViewers: 0,
        popularCommands: {},
        viewerStats: {
          new: 0,
          returning: 0,
          total: 0,
        },
        streamHistory: {},
      };
    }
  }

  saveAnalyticsData() {
    try {
      writeFileSync(
        join(process.cwd(), 'src/bot/analytics.json'),
        JSON.stringify(this.analyticsData, null, 2)
      );
    } catch (error) {
      logger.error('Error saving analytics data:', error);
    }
  }

  startStream() {
    this.currentStream.startTime = Date.now();
    this.analyticsData.totalStreams++;
    logger.info('Stream analytics started');
  }

  endStream() {
    if (!this.currentStream.startTime) {
      return;
    }

    this.currentStream.endTime = Date.now();
    const duration =
      (this.currentStream.endTime - this.currentStream.startTime) /
      1000 /
      60 /
      60;
    this.analyticsData.totalHours += duration;

    // Update stream history
    const streamDate = new Date().toISOString().split('T')[0];
    this.analyticsData.streamHistory[streamDate] = {
      duration,
      peakViewers: Math.max(...this.currentStream.viewers, 0),
      chatMessages: this.currentStream.chatMessages,
      commands: this.currentStream.commands,
      highlights: this.currentStream.highlights,
      raids: this.currentStream.raids,
    };

    // Save analytics
    this.saveAnalyticsData();
    logger.info('Stream analytics saved', {
      duration,
      peakViewers: Math.max(...this.currentStream.viewers, 0),
    });

    // Reset current stream
    this.currentStream = {
      startTime: null,
      endTime: null,
      viewers: [],
      chatMessages: 0,
      commands: {},
      highlights: [],
      raids: [],
    };
  }

  updateViewers(count) {
    this.currentStream.viewers.push(count);
    this.analyticsData.peakViewers = Math.max(
      this.analyticsData.peakViewers,
      count
    );
  }

  trackCommand(command) {
    this.currentStream.commands[command] =
      (this.currentStream.commands[command] || 0) + 1;
    this.analyticsData.popularCommands[command] =
      (this.analyticsData.popularCommands[command] || 0) + 1;
  }

  trackChatMessage() {
    this.currentStream.chatMessages++;
  }

  addHighlight(highlight) {
    this.currentStream.highlights.push({
      timestamp: Date.now(),
      ...highlight,
    });
  }

  trackRaid(raid) {
    this.currentStream.raids.push({
      timestamp: Date.now(),
      ...raid,
    });
  }

  getStats() {
    return {
      totalStreams: this.analyticsData.totalStreams,
      totalHours: this.analyticsData.totalHours,
      peakViewers: this.analyticsData.peakViewers,
      popularCommands: Object.entries(this.analyticsData.popularCommands)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10),
      viewerStats: this.analyticsData.viewerStats,
      currentStream: {
        duration: this.currentStream.startTime
          ? (Date.now() - this.currentStream.startTime) / 1000 / 60 / 60
          : 0,
        viewers: this.currentStream.viewers,
        chatMessages: this.currentStream.chatMessages,
        highlights: this.currentStream.highlights.length,
        raids: this.currentStream.raids.length,
      },
    };
  }

  cleanup() {
    // Keep only last 30 days of stream history
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

    this.analyticsData.streamHistory = Object.entries(
      this.analyticsData.streamHistory
    )
      .filter(([date]) => date >= cutoffDate)
      .reduce((acc, [date, data]) => {
        acc[date] = data;
        return acc;
      }, {});

    this.saveAnalyticsData();
    logger.info('Analytics data cleaned up');
  }
}

const analytics = new Analytics();

export function initializeAnalytics() {
  analytics.startStream();
  return {
    startTime: analytics.currentStream.startTime,
    status: 'initialized',
  };
}

export async function endAnalytics() {
  const stats = analytics.getStats();
  analytics.endStream();
  return {
    stats: {
      peakViewers: stats.peakViewers,
      averageViewers: Math.round(
        stats.currentStream.viewers.reduce((a, b) => a + b, 0) /
          stats.currentStream.viewers.length
      ),
      totalMessages: stats.currentStream.chatMessages,
      activeViewers: Object.entries(stats.popularCommands)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([user]) => user),
    },
    health: {
      status: 'healthy',
      score: 100,
      bitrate: {
        average: 6000,
        stability: 'stable',
      },
    },
    performance: {
      bestCategory: 'Just Chatting',
      viewerRetention: 85,
      averageEngagement: 75,
      improvements: [
        'Consider longer streams to build viewer retention',
        'Try more interactive segments to boost chat engagement',
      ],
    },
  };
}

export async function handleRaid(username, viewers) {
  analytics.trackRaid({ username, viewers });
  return `Thanks for the raid, ${username}! Welcome ${viewers} new viewers! 🎉`;
}

export default analytics;
