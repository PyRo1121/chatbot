import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { ApiClient } from '@twurple/api';
import { RefreshingAuthProvider } from '@twurple/auth';
import tokenManager from '../auth/tokenManager.js';
import logger from '../utils/logger.js';

class CompetitorAnalysis {
  constructor() {
    this.apiClient = null;
    this.dbPath = join(process.cwd(), 'src/bot/competitor_data.json');
    this.data = this.loadData();
    this.UPDATE_INTERVAL = 60 * 60 * 1000; // 1 hour
    this.lastUpdate = 0;
    this.initializeApiClient();
  }

  async initializeApiClient() {
    try {
      const tokens = tokenManager.getBroadcasterTokens();

      // Initialize auth provider
      const authProvider = new RefreshingAuthProvider({
        clientId: tokens.clientId,
        clientSecret: tokens.clientSecret,
        onRefresh: async (userId, newTokenData) => {
          try {
            await tokenManager.updateBroadcasterTokens(newTokenData);
            logger.info('Broadcaster token refreshed successfully for competitor analysis');
          } catch (error) {
            logger.error('Error in competitor analysis auth provider refresh:', error);
            throw error;
          }
        },
      });

      // Add broadcaster credentials
      await authProvider.addUserForToken({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 14400,
        obtainmentTimestamp: Date.now(),
        userId: tokens.userId,
        scope: [
          'channel:read:subscriptions',
          'channel:read:followers',
          'user:read:follows',
          'user:read:broadcast',
          'moderator:read:followers',
        ],
      });

      // Initialize API client with auth provider
      this.apiClient = new ApiClient({
        authProvider,
        authId: tokens.userId,
      });

      logger.info('Twitch API client initialized for competitor analysis');
    } catch (error) {
      logger.error('Failed to initialize Twitch API client:', error);
      throw error;
    }
  }

  async handleApiError(error, operation) {
    logger.error(`API error during ${operation}:`, error);
    if (error.message?.includes('invalid token') || error.message?.includes('unauthorized')) {
      logger.info('Token appears invalid, attempting refresh...');
      const refreshed = await tokenManager.refreshToken('broadcaster');
      if (refreshed) {
        logger.info('Token refreshed successfully, reinitializing API client');
        await this.initializeApiClient();
        return true;
      }
    }
    return false;
  }

  loadData() {
    try {
      if (existsSync(this.dbPath)) {
        const data = readFileSync(this.dbPath, 'utf8');
        return JSON.parse(data);
      }
      const defaultData = {
        trackedChannels: [],
        marketAnalysis: {
          categoryTrends: {},
          peakTimes: {},
          contentTypes: {},
        },
        growthMetrics: {},
        lastUpdated: new Date().toISOString(),
      };
      this.saveData(defaultData);
      return defaultData;
    } catch (error) {
      logger.error('Error loading competitor data:', error);
      return this.getDefaultData();
    }
  }

  saveData(data = this.data) {
    try {
      writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error('Error saving competitor data:', error);
    }
  }

  async addTrackedChannel(username) {
    try {
      if (!this.apiClient) {
        await this.initializeApiClient();
      }

      let user;
      try {
        user = await this.apiClient.users.getUserByName(username);
      } catch (error) {
        const retried = await this.handleApiError(error, 'getUserByName');
        if (retried) {
          user = await this.apiClient.users.getUserByName(username);
        } else {
          throw error;
        }
      }

      if (!user) {
        throw new Error(`Channel ${username} not found`);
      }

      if (!this.data.trackedChannels.find((channel) => channel.id === user.id)) {
        this.data.trackedChannels.push({
          id: user.id,
          username: user.name,
          displayName: user.displayName,
          category: '',
          followers: 0,
          avgViewers: 0,
          peakViewers: 0,
          streamFrequency: 0,
          contentTypes: [],
          addedAt: new Date().toISOString(),
        });
        this.saveData();
      }
      await this.updateChannelStats(user.id);
      return true;
    } catch (error) {
      logger.error('Error adding tracked channel:', error);
      return false;
    }
  }

  async updateChannelStats(channelId) {
    try {
      if (!this.apiClient) {
        await this.initializeApiClient();
      }

      let channel;
      let stream;
      try {
        channel = await this.apiClient.channels.getChannelInfoById(channelId);
        stream = await this.apiClient.streams.getStreamByUserId(channelId);
      } catch (error) {
        const retried = await this.handleApiError(error, 'getChannelInfo');
        if (retried) {
          channel = await this.apiClient.channels.getChannelInfoById(channelId);
          stream = await this.apiClient.streams.getStreamByUserId(channelId);
        } else {
          throw error;
        }
      }

      const channelIndex = this.data.trackedChannels.findIndex((c) => c.id === channelId);
      if (channelIndex === -1) {
        return;
      }

      const followerCount = await this.getFollowerCount(channelId);

      // Update basic stats
      this.data.trackedChannels[channelIndex] = {
        ...this.data.trackedChannels[channelIndex],
        category: channel.gameName || '',
        followers: followerCount,
        avgViewers: stream ? stream.averageViewCount : 0,
        peakViewers: stream ? stream.peakViewCount : 0,
        lastUpdated: new Date().toISOString(),
      };

      // Update growth metrics
      if (!this.data.growthMetrics[channelId]) {
        this.data.growthMetrics[channelId] = [];
      }

      this.data.growthMetrics[channelId].push({
        timestamp: new Date().toISOString(),
        followers: this.data.trackedChannels[channelIndex].followers,
        avgViewers: this.data.trackedChannels[channelIndex].avgViewers,
      });

      // Keep only last 30 days of metrics
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      this.data.growthMetrics[channelId] = this.data.growthMetrics[channelId].filter(
        (metric) => new Date(metric.timestamp) > thirtyDaysAgo
      );

      this.saveData();
    } catch (error) {
      logger.error('Error updating channel stats:', error);
    }
  }

  async getFollowerCount(channelId) {
    try {
      if (!this.apiClient) {
        await this.initializeApiClient();
      }

      let followers;
      try {
        // Use getChannelFollowerCount instead of getChannelFollowers
        followers = await this.apiClient.channels.getChannelFollowerCount(channelId);
      } catch (error) {
        const retried = await this.handleApiError(error, 'getChannelFollowerCount');
        if (retried) {
          followers = await this.apiClient.channels.getChannelFollowerCount(channelId);
        } else {
          throw error;
        }
      }
      return followers;
    } catch (error) {
      logger.error('Error getting follower count:', error);
      return 0;
    }
  }

  async updateAllChannels() {
    try {
      if (!this.apiClient) {
        await this.initializeApiClient();
      }

      const now = Date.now();
      if (now - this.lastUpdate < this.UPDATE_INTERVAL) {
        return;
      }

      // Use Promise.all to handle all updates concurrently
      await Promise.all(
        this.data.trackedChannels.map((channel) => this.updateChannelStats(channel.id))
      );

      this.analyzeMarketTrends();
      this.lastUpdate = now;
    } catch (error) {
      logger.error('Error updating all channels:', error);
    }
  }

  analyzeMarketTrends() {
    const trends = {
      categories: {},
      peakTimes: {},
      contentTypes: {},
      growth: {},
    };

    // Analyze all tracked channels
    for (const channel of this.data.trackedChannels) {
      // Category analysis
      if (channel.category) {
        trends.categories[channel.category] = (trends.categories[channel.category] || 0) + 1;
      }

      // Growth analysis
      const metrics = this.data.growthMetrics[channel.id];
      if (metrics && metrics.length >= 2) {
        const [oldestMetric, ...rest] = metrics;
        const latestMetric = rest[rest.length - 1];
        const growthRate =
          ((latestMetric.followers - oldestMetric.followers) / oldestMetric.followers) * 100;
        trends.growth[channel.username] = {
          rate: growthRate,
          followers: latestMetric.followers,
          avgViewers: latestMetric.avgViewers,
        };
      }
    }

    this.data.marketAnalysis = {
      ...this.data.marketAnalysis,
      categoryTrends: trends.categories,
      growth: trends.growth,
      lastUpdated: new Date().toISOString(),
    };

    this.saveData();
  }

  getCompetitorInsights() {
    const insights = {
      topCategories: Object.entries(this.data.marketAnalysis.categoryTrends)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([category, count]) => ({ category, count })),

      fastestGrowing: Object.entries(this.data.marketAnalysis.growth || {})
        .sort(([, a], [, b]) => b.rate - a.rate)
        .slice(0, 5)
        .map(([channel, stats]) => ({
          channel,
          growthRate: Math.round(stats.rate * 100) / 100,
          followers: stats.followers,
          avgViewers: stats.avgViewers,
        })),

      trackedChannels: this.data.trackedChannels.map((channel) => ({
        username: channel.username,
        category: channel.category,
        followers: channel.followers,
        avgViewers: channel.avgViewers,
      })),
    };

    return insights;
  }

  getContentSuggestions() {
    const suggestions = [];
    const trends = this.data.marketAnalysis.categoryTrends;

    // Suggest top performing categories
    const topCategories = Object.entries(trends)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([category]) => category);

    suggestions.push({
      type: 'category',
      message: `Top performing categories: ${topCategories.join(', ')}`,
      reason: 'These categories are currently trending among similar channels',
    });

    // Analyze successful channels
    const successfulChannels = Object.entries(this.data.marketAnalysis.growth || {})
      .sort(([, a], [, b]) => b.rate - a.rate)
      .slice(0, 3);

    for (const [channel, stats] of successfulChannels) {
      const trackedChannel = this.data.trackedChannels.find((c) => c.username === channel);
      if (trackedChannel) {
        suggestions.push({
          type: 'strategy',
          message: `Consider analyzing ${channel}'s content strategy in ${trackedChannel.category}`,
          reason: `Growing at ${Math.round(stats.rate)}% with ${stats.avgViewers} average viewers`,
        });
      }
    }

    return suggestions;
  }

  removeTrackedChannel(username) {
    const index = this.data.trackedChannels.findIndex((channel) => channel.username === username);
    if (index !== -1) {
      this.data.trackedChannels.splice(index, 1);
      delete this.data.growthMetrics[username];
      this.saveData();
      return true;
    }
    return false;
  }
}

export default CompetitorAnalysis;
