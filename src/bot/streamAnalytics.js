import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import logger from '../utils/logger.js';
import { generateResponse } from '../utils/openai.js';
import { ApiClient } from '@twurple/api';
import { RefreshingAuthProvider } from '@twurple/auth';
import tokenManager from '../auth/tokenManager.js';

class StreamAnalytics {
  constructor() {
    this.dbPath = join(process.cwd(), 'src/bot/stream_analytics.json');
    this.data = this.loadData();
    this.UPDATE_INTERVAL = 60000; // 1 minute
    this.lastUpdate = 0;
    this.currentStreamData = {
      startTime: null,
      peakViewers: 0,
      averageViewers: 0,
      samples: 0,
      bitrate: 0,
      droppedFrames: 0,
      healthChecks: [],
      categoryPerformance: {},
    };
  }

  loadData() {
    try {
      if (existsSync(this.dbPath)) {
        const data = readFileSync(this.dbPath, 'utf8');
        return JSON.parse(data);
      }
      const defaultData = {
        streamHistory: [],
        categoryStats: {},
        timeStats: {},
        healthHistory: [],
        growthMetrics: {
          viewerRetention: [],
          followConversion: [],
          engagementRates: [],
        },
      };
      this.saveData(defaultData);
      return defaultData;
    } catch (error) {
      logger.error('Error loading stream analytics data:', error);
      return {
        streamHistory: [],
        categoryStats: {},
        timeStats: {},
        healthHistory: [],
        growthMetrics: {
          viewerRetention: [],
          followConversion: [],
          engagementRates: [],
        },
      };
    }
  }

  saveData(data = this.data) {
    try {
      writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error('Error saving stream analytics data:', error);
    }
  }

  async initializeStream() {
    // Wait for any previous stream data to be cleaned up
    await new Promise((resolve) => setTimeout(resolve, 100));
    this.currentStreamData = {
      startTime: new Date().toISOString(),
      peakViewers: 0,
      averageViewers: 0,
      samples: 0,
      bitrate: 0,
      droppedFrames: 0,
      healthChecks: [],
      categoryPerformance: {},
    };
  }

  async updateStreamHealth() {
    try {
      const tokens = await tokenManager.getBroadcasterTokens();
      const authProvider = new RefreshingAuthProvider({
        clientId: tokens.clientId,
        clientSecret: tokens.clientSecret,
        onRefresh: async (userId, newTokenData) => {
          await tokenManager.updateBroadcasterTokens(newTokenData);
        },
      });

      await authProvider.addUserForToken({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 0,
        obtainmentTimestamp: 0,
      });

      const apiClient = new ApiClient({ authProvider });
      const stream = await apiClient.streams.getStreamByUserId(tokens.userId);

      if (stream) {
        const healthCheck = {
          timestamp: new Date().toISOString(),
          bitrate: stream.bitrate || 0,
          droppedFrames: 0, // Would need to be tracked separately
          viewers: stream.viewers,
        };

        this.currentStreamData.healthChecks.push(healthCheck);
        this.currentStreamData.peakViewers = Math.max(
          this.currentStreamData.peakViewers,
          stream.viewers
        );
        this.currentStreamData.averageViewers =
          (this.currentStreamData.averageViewers * this.currentStreamData.samples +
            stream.viewers) /
          (this.currentStreamData.samples + 1);
        this.currentStreamData.samples++;

        // Update category performance
        const category = stream.gameName;
        if (category) {
          if (!this.currentStreamData.categoryPerformance[category]) {
            this.currentStreamData.categoryPerformance[category] = {
              duration: 0,
              peakViewers: 0,
              averageViewers: 0,
              samples: 0,
            };
          }

          const catStats = this.currentStreamData.categoryPerformance[category];
          catStats.duration += this.UPDATE_INTERVAL / 1000; // Convert to seconds
          catStats.peakViewers = Math.max(catStats.peakViewers, stream.viewers);
          catStats.averageViewers =
            (catStats.averageViewers * catStats.samples + stream.viewers) / (catStats.samples + 1);
          catStats.samples++;
        }

        return healthCheck;
      }
    } catch (error) {
      logger.error('Error updating stream health:', error);
    }
    return null;
  }

  async analyzeStreamPerformance() {
    try {
      const prompt = `Analyze this stream performance data and provide insights:
Stream Data: ${JSON.stringify(this.currentStreamData)}
Historical Data: ${JSON.stringify(this.data)}

Focus on:
1. Stream health and technical performance
2. Category performance and viewer engagement
3. Growth trends and patterns
4. Optimization recommendations

Respond with JSON only:
{
  "health": {
    "status": "string (excellent/good/fair/poor)",
    "issues": ["array of identified issues"],
    "recommendations": ["array of technical recommendations"]
  },
  "performance": {
    "bestCategory": "string (best performing category)",
    "viewerRetention": "number (percentage)",
    "peakTimes": ["array of peak performance times"],
    "suggestions": ["array of content/scheduling suggestions"]
  }
}`;

      const response = await generateResponse(prompt);
      return JSON.parse(response);
    } catch (error) {
      logger.error('Error analyzing stream performance:', error);
      return null;
    }
  }

  async endStream() {
    if (this.currentStreamData.startTime) {
      const endTime = new Date().toISOString();
      const analysis = await this.analyzeStreamPerformance();

      // Record stream history
      this.data.streamHistory.push({
        startTime: this.currentStreamData.startTime,
        endTime,
        peakViewers: this.currentStreamData.peakViewers,
        averageViewers: this.currentStreamData.averageViewers,
        categoryPerformance: this.currentStreamData.categoryPerformance,
        healthSummary: {
          averageBitrate:
            this.currentStreamData.healthChecks.reduce((sum, check) => sum + check.bitrate, 0) /
            this.currentStreamData.healthChecks.length,
          droppedFrames: this.currentStreamData.droppedFrames,
          issues: analysis?.health.issues || [],
        },
      });

      // Update category stats
      Object.entries(this.currentStreamData.categoryPerformance).forEach(([category, stats]) => {
        if (!this.data.categoryStats[category]) {
          this.data.categoryStats[category] = {
            totalDuration: 0,
            peakViewers: 0,
            averageViewers: 0,
            streams: 0,
          };
        }

        const catStats = this.data.categoryStats[category];
        catStats.totalDuration += stats.duration;
        catStats.peakViewers = Math.max(catStats.peakViewers, stats.peakViewers);
        catStats.averageViewers =
          (catStats.averageViewers * catStats.streams + stats.averageViewers) /
          (catStats.streams + 1);
        catStats.streams++;
      });

      // Update time stats
      const streamStart = new Date(this.currentStreamData.startTime);
      const hour = streamStart.getHours();
      if (!this.data.timeStats[hour]) {
        this.data.timeStats[hour] = {
          averageViewers: 0,
          peakViewers: 0,
          streams: 0,
        };
      }

      const timeStats = this.data.timeStats[hour];
      timeStats.averageViewers =
        (timeStats.averageViewers * timeStats.streams + this.currentStreamData.averageViewers) /
        (timeStats.streams + 1);
      timeStats.peakViewers = Math.max(timeStats.peakViewers, this.currentStreamData.peakViewers);
      timeStats.streams++;

      this.saveData();
      return analysis;
    }
    return null;
  }

  getStreamHealth() {
    if (!this.currentStreamData.startTime) {
      return 'Stream is offline';
    }

    const latestHealth =
      this.currentStreamData.healthChecks[this.currentStreamData.healthChecks.length - 1];
    if (!latestHealth) {
      return 'No health data available';
    }

    return {
      bitrate: latestHealth.bitrate,
      droppedFrames: this.currentStreamData.droppedFrames,
      viewers: latestHealth.viewers,
      uptime: Math.floor((new Date() - new Date(this.currentStreamData.startTime)) / 1000 / 60), // minutes
    };
  }

  getBestTimes() {
    const timeStats = Object.entries(this.data.timeStats)
      .map(([hour, stats]) => ({
        hour: parseInt(hour),
        score: stats.averageViewers * 0.7 + stats.peakViewers * 0.3,
        stats,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return timeStats.map((time) => ({
      hour: time.hour,
      averageViewers: Math.round(time.stats.averageViewers),
      peakViewers: time.stats.peakViewers,
    }));
  }

  getTopCategories() {
    return Object.entries(this.data.categoryStats)
      .map(([category, stats]) => ({
        category,
        score: stats.averageViewers * 0.7 + stats.peakViewers * 0.3,
        stats,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  async getStreamInsights() {
    const analysis = await this.analyzeStreamPerformance();
    const health = this.getStreamHealth();
    const bestTimes = this.getBestTimes();
    const topCategories = this.getTopCategories();

    return {
      currentStream: {
        health,
        analysis: analysis?.health || null,
        performance: analysis?.performance || null,
      },
      historical: {
        bestTimes,
        topCategories,
        totalStreams: this.data.streamHistory.length,
      },
    };
  }
}

const streamAnalytics = new StreamAnalytics();
export default streamAnalytics;
