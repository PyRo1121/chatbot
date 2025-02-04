import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import logger from '../utils/logger.js';
import { generateResponse } from '../utils/gemini.js';

class StreamAnalytics {
  constructor() {
    this.analyticsData = this.loadAnalyticsData();
    this.initializeData();
  }

  loadAnalyticsData() {
    try {
      const data = readFileSync(join(process.cwd(), 'src/bot/stream_analytics.json'), 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error loading stream analytics data:', error);
      return {
        streams: {},
        performance: {
          categories: {},
          times: {},
          engagement: {
            chatActivity: 0,
            commands: {},
            retention: 0,
          },
        },
        recommendations: [],
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  saveAnalyticsData() {
    try {
      writeFileSync(
        join(process.cwd(), 'src/bot/stream_analytics.json'),
        JSON.stringify(this.analyticsData, null, 2)
      );
    } catch (error) {
      logger.error('Error saving stream analytics data:', error);
    }
  }

  initializeData() {
    if (!this.analyticsData.streams) {
      this.analyticsData.streams = {};
    }
    if (!this.analyticsData.performance) {
      this.analyticsData.performance = {
        categories: {},
        times: {},
        engagement: {
          chatActivity: 0,
          commands: {},
          retention: 0,
        },
      };
    }
    if (!this.analyticsData.recommendations) {
      this.analyticsData.recommendations = [];
    }
  }

  async getStreamHealth() {
    try {
      const currentStream = this.getCurrentStream();
      if (!currentStream) {
        return {
          status: 'offline',
          score: 0,
          bitrate: {
            average: 0,
            stability: 'N/A',
          },
        };
      }

      const score = this.calculateHealthScore(currentStream);
      const getHealthStatus = (score) => {
        if (score > 70) {
          return 'healthy';
        }
        if (score > 40) {
          return 'warning';
        }
        return 'critical';
      };

      return {
        status: getHealthStatus(score),
        score,
        bitrate: {
          average: currentStream.bitrate?.average || 0,
          stability: currentStream.bitrate?.stability || 'stable',
        },
      };
    } catch (error) {
      logger.error('Error getting stream health:', error);
      return null;
    }
  }

  calculateHealthScore(stream) {
    let score = 100;

    // Viewer retention impact
    if (stream.viewers && stream.viewers.length > 1) {
      const retention = stream.viewers[stream.viewers.length - 1] / Math.max(...stream.viewers);
      score -= (1 - retention) * 30;
    }

    // Chat activity impact
    const expectedChatActivity = stream.duration * 2; // 2 messages per minute
    if (stream.chatActivity < expectedChatActivity) {
      score -= 20 * (1 - stream.chatActivity / expectedChatActivity);
    }

    // Technical issues impact
    if (stream.issues && stream.issues.length > 0) {
      score -= stream.issues.length * 10;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  async getStreamPerformance() {
    try {
      const performance = {
        viewerRetention: this.calculateRetention(),
        averageEngagement: this.calculateEngagement(),
        bestCategory: this.getBestCategory(),
        peakConcurrent: this.getPeakConcurrent(),
        chatActivity: this.getChatActivity(),
        commandUsage: this.getCommandUsage(),
      };

      return performance;
    } catch (error) {
      logger.error('Error getting stream performance:', error);
      return null;
    }
  }

  calculateRetention() {
    const streams = Object.values(this.analyticsData.streams);
    if (streams.length === 0) {
      return 0;
    }

    const retentions = streams.map((stream) => {
      if (!stream.viewers || stream.viewers.length < 2) {
        return 0;
      }
      return stream.viewers[stream.viewers.length - 1] / Math.max(...stream.viewers);
    });

    return Math.round((retentions.reduce((a, b) => a + b, 0) / retentions.length) * 100);
  }

  calculateEngagement() {
    const streams = Object.values(this.analyticsData.streams);
    if (streams.length === 0) {
      return 0;
    }

    const engagements = streams.map((stream) => {
      const duration = stream.duration || 1;
      const chatPerMinute = stream.chatActivity / duration;
      const commandsPerHour =
        Object.values(stream.commands || {}).reduce((a, b) => a + b, 0) / (duration / 60);
      return (chatPerMinute * 0.7 + commandsPerHour * 0.3) / 2;
    });

    return Math.round((engagements.reduce((a, b) => a + b, 0) / engagements.length) * 100);
  }

  async getBestStreamingTimes() {
    try {
      const timeSlots = Object.entries(this.analyticsData.performance.times)
        .map(([time, data]) => ({
          time,
          averageViewers: data.totalViewers / data.streams,
          engagement: data.engagement / data.streams,
        }))
        .sort((a, b) => b.averageViewers - a.averageViewers);

      return timeSlots.slice(0, 5);
    } catch (error) {
      logger.error('Error getting best streaming times:', error);
      return [];
    }
  }

  async getTopCategories() {
    try {
      return Object.entries(this.analyticsData.performance.categories)
        .map(([name, data]) => ({
          name,
          hours: Math.round(data.duration / 60),
          averageViewers: Math.round(data.totalViewers / data.streams),
          engagement: Math.round(data.engagement / data.streams),
        }))
        .sort((a, b) => b.averageViewers - a.averageViewers)
        .slice(0, 5);
    } catch (error) {
      logger.error('Error getting top categories:', error);
      return [];
    }
  }

  async getRecommendations(stats) {
    try {
      const prompt = `Based on these stream stats, provide recommendations:
      Average Viewers: ${stats.viewerStats.average}
      Retention: ${this.calculateRetention()}%
      Engagement: ${this.calculateEngagement()}%
      Best Category: ${this.getBestCategory()}
      Best Time: ${(await this.getBestStreamingTimes())[0]?.time}
      
      Provide 2-3 actionable recommendations for improvement.
      Keep it concise, max 200 characters.`;

      const recommendations = await generateResponse(prompt);
      return recommendations ? recommendations.split('|') : [];
    } catch (error) {
      logger.error('Error generating recommendations:', error);
      return [];
    }
  }

  getBestCategory() {
    const categories = Object.entries(this.analyticsData.performance.categories);
    if (categories.length === 0) {
      return 'N/A';
    }

    return categories.sort(
      ([, a], [, b]) => b.totalViewers / b.streams - a.totalViewers / a.streams
    )[0][0];
  }

  getPeakConcurrent() {
    const streams = Object.values(this.analyticsData.streams);
    if (streams.length === 0) {
      return 0;
    }

    return Math.max(...streams.map((stream) => Math.max(...(stream.viewers || [0]))));
  }

  getChatActivity() {
    return this.analyticsData.performance.engagement.chatActivity;
  }

  getCommandUsage() {
    return this.analyticsData.performance.engagement.commands;
  }

  getCurrentStream() {
    const streams = Object.values(this.analyticsData.streams);
    if (streams.length === 0) {
      return null;
    }

    return streams[streams.length - 1];
  }

  cleanup() {
    try {
      // Keep only last 30 days of streams
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      this.analyticsData.streams = Object.entries(this.analyticsData.streams)
        .filter(([date]) => new Date(date) > thirtyDaysAgo)
        .reduce((acc, [date, data]) => {
          acc[date] = data;
          return acc;
        }, {});

      // Reset and recalculate performance metrics
      this.analyticsData.performance = {
        categories: {},
        times: {},
        engagement: {
          chatActivity: 0,
          commands: {},
          retention: 0,
        },
      };

      // Recalculate from remaining streams
      Object.values(this.analyticsData.streams).forEach((stream) => {
        if (stream.category) {
          if (!this.analyticsData.performance.categories[stream.category]) {
            this.analyticsData.performance.categories[stream.category] = {
              duration: 0,
              totalViewers: 0,
              streams: 0,
              engagement: 0,
            };
          }
          const category = this.analyticsData.performance.categories[stream.category];
          category.duration += stream.duration;
          category.totalViewers += stream.viewers?.reduce((a, b) => a + b, 0) || 0;
          category.streams++;
          category.engagement += stream.chatActivity;
        }

        const hour = new Date(stream.startTime).getHours();
        if (!this.analyticsData.performance.times[hour]) {
          this.analyticsData.performance.times[hour] = {
            totalViewers: 0,
            streams: 0,
            engagement: 0,
          };
        }
        const timeSlot = this.analyticsData.performance.times[hour];
        timeSlot.totalViewers += stream.viewers?.reduce((a, b) => a + b, 0) || 0;
        timeSlot.streams++;
        timeSlot.engagement += stream.chatActivity;
      });

      this.analyticsData.lastUpdated = new Date().toISOString();
      this.saveAnalyticsData();
      logger.info('Stream analytics data cleaned up');
      return true;
    } catch (error) {
      logger.error('Error cleaning up stream analytics data:', error);
      return false;
    }
  }
}

const streamAnalytics = new StreamAnalytics();
export default streamAnalytics;
