/**
 * @fileoverview Advanced competitor analysis service for Twitch channels
 * Implements data persistence, caching, and efficient API usage
 */

import { join } from 'path';
import { promises as fsPromises, writeFileSync, readFileSync } from 'fs';
import logger from '../utils/logger.js';
import { generateResponse } from '../utils/gemini.js';
import competitorManager from './competitorManager.js';
import getClient from './twitchClient.js';
import Bottleneck from 'bottleneck';

// Constants
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const BATCH_SIZE = 5;
const RATE_LIMIT_CONFIG = {
  minTime: 1000,
  maxConcurrent: 2,
};

// Rate limiter instance
const limiter = new Bottleneck(RATE_LIMIT_CONFIG);

/**
 * @typedef {Object} CompetitorMetrics
 * @property {Map<string, number>} categoryTrends - Game category trends
 * @property {Map<string, number>} peakTimes - Peak streaming times
 * @property {Map<string, string[]>} contentTypes - Content type analysis
 */

/**
 * @typedef {Object} CompetitorDataStructure
 * @property {Array<Object>} trackedChannels - List of tracked channels
 * @property {CompetitorMetrics} marketAnalysis - Market analysis data
 * @property {Map<string, Array<Object>>} growthMetrics - Growth metrics by channel
 * @property {string} lastUpdated - Last update timestamp
 */

class CompetitorAnalysis {
  constructor() {
    this.dataPath = join(process.cwd(), 'src/bot/competitor_data.json');
    this.competitorData = null;
    this.cache = new Map();
    this.initPromise = this.initialize();

    // Start periodic cache cleanup
    setInterval(() => this.cleanupCache(), CACHE_DURATION);
  }

  /**
   * Clean up expired cache entries
   * @private
   */
  cleanupCache() {
    const now = Date.now();
    for (const [key, { timestamp }] of this.cache) {
      if (now - timestamp > CACHE_DURATION) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Initialize the competitor analysis service
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.competitorData = await this.loadCompetitorData();
      this.initializeTracking();
      logger.info('Competitor analysis initialized successfully');
    } catch (error) {
      logger.error({
        message: 'Initialization failed',
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Load competitor data from persistent storage
   * @returns {Promise<CompetitorDataStructure>}
   */
  async loadCompetitorData() {
    try {
      const data = await fsPromises.readFile(this.dataPath, 'utf8');
      const parsedData = JSON.parse(data);

      // Convert the data to our internal structure
      return {
        trackedChannels: parsedData.trackedChannels || [],
        marketAnalysis: {
          categoryTrends: new Map(Object.entries(parsedData.marketAnalysis?.categoryTrends || {})),
          peakTimes: new Map(Object.entries(parsedData.marketAnalysis?.peakTimes || {})),
          contentTypes: new Map(Object.entries(parsedData.marketAnalysis?.contentTypes || {})),
        },
        growthMetrics: new Map(Object.entries(parsedData.growthMetrics || {})),
        lastUpdated: parsedData.lastUpdated || new Date().toISOString(),
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('Creating new competitor data file');
        const defaultData = this.getDefaultDataStructure();
        await this.saveCompetitorData(defaultData);
        return defaultData;
      }
      logger.error({
        message: 'Error loading competitor data',
        error: error.message,
      });
      throw new Error('Failed to load competitor data');
    }
  }

  /**
   * Get default data structure
   * @returns {CompetitorDataStructure}
   * @private
   */
  getDefaultDataStructure() {
    return {
      trackedChannels: [],
      marketAnalysis: {
        categoryTrends: new Map(),
        peakTimes: new Map(),
        contentTypes: new Map(),
      },
      growthMetrics: new Map(),
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Save competitor data to persistent storage
   * @param {CompetitorDataStructure} data - Data to save
   * @private
   */
  async saveCompetitorData(data = this.competitorData) {
    try {
      const serializedData = {
        trackedChannels: data.trackedChannels,
        marketAnalysis: {
          categoryTrends: Object.fromEntries(data.marketAnalysis.categoryTrends),
          peakTimes: Object.fromEntries(data.marketAnalysis.peakTimes),
          contentTypes: Object.fromEntries(data.marketAnalysis.contentTypes),
        },
        growthMetrics: Object.fromEntries(data.growthMetrics),
        lastUpdated: data.lastUpdated,
      };

      await fsPromises.writeFile(this.dataPath, JSON.stringify(serializedData, null, 2));

      logger.info('Saved competitor data to file');
    } catch (error) {
      logger.error({
        message: 'Error saving competitor data',
        error: error.message,
      });
      throw new Error('Failed to save competitor data');
    }
  }

  /**
   * Initialize tracking system
   * @private
   */
  initializeTracking() {
    if (!Array.isArray(this.competitorData.trackedChannels)) {
      this.competitorData.trackedChannels = [];
      this.saveCompetitorData();
    }
  }

  /**
   * Track a new channel
   * @param {string} channel - Channel name to track
   * @param {Object} twitchClient - Initialized Twitch client
   * @returns {Promise<string>} Status message
   */
  async trackChannel(channel, twitchClient) {
    try {
      const channelName = channel.toLowerCase();
      const existingChannel = this.competitorData.trackedChannels.find(
        (ch) => ch.username.toLowerCase() === channelName
      );

      if (existingChannel) {
        return `@${existingChannel.displayName} is already being tracked!`;
      }

      if (!twitchClient) {
        throw new Error('Twitch client not initialized');
      }

      const success = await competitorManager.trackChannel(twitchClient, channelName);

      if (success) {
        const channelInfo = await twitchClient.apiClient.users.getUserByName(channelName);
        if (!channelInfo) {
          throw new Error(`Could not fetch channel info for ${channelName}`);
        }

        this.competitorData.trackedChannels.push({
          username: channelName,
          displayName: channelInfo.displayName,
          category: '',
          followers: 0,
          streamFrequency: 0,
          contentTypes: [],
          addedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        });

        await this.saveCompetitorData();
        return success;
      }

      return `Failed to track @${channel}`;
    } catch (error) {
      logger.error({
        message: 'Error tracking channel',
        channel,
        error: error.message,
      });
      throw new Error(`Failed to track ${channel}: ${error.message}`);
    }
  }

  /**
   * Stop tracking a channel
   * @param {string} channel - Channel name to untrack
   * @param {Object} twitchClient - Initialized Twitch client
   * @returns {Promise<string>} Status message
   */
  async untrackChannel(channel, twitchClient) {
    try {
      const channelName = channel.toLowerCase();
      const channelIndex = this.competitorData.trackedChannels.findIndex(
        (ch) => ch.username.toLowerCase() === channelName
      );

      if (channelIndex === -1) {
        return `@${channel} is not being tracked!`;
      }

      if (!twitchClient) {
        throw new Error('Twitch client not initialized');
      }

      const result = await competitorManager.untrackChannel(channelName);

      if (result) {
        const { displayName } = this.competitorData.trackedChannels[channelIndex];
        this.competitorData.trackedChannels.splice(channelIndex, 1);
        await this.saveCompetitorData();
        return result;
      }

      return `@${channel} is not being tracked!`;
    } catch (error) {
      logger.error({
        message: 'Error untracking channel',
        channel,
        error: error.message,
      });
      throw new Error(`Failed to untrack ${channel}: ${error.message}`);
    }
  }

  /**
   * Update channel data with new stream information
   * @param {string} channel - Channel name
   * @param {Object} streamData - Stream data
   * @returns {Promise<void>}
   */
  async updateChannelData(channel, streamData) {
    try {
      const channelName = channel.toLowerCase();
      const channelIndex = this.competitorData.trackedChannels.findIndex(
        (ch) => ch.username.toLowerCase() === channelName
      );

      if (channelIndex === -1) {
        return;
      }

      const channelData = this.competitorData.trackedChannels[channelIndex];
      channelData.category = streamData.game;
      channelData.lastUpdated = new Date().toISOString();

      // Update growth metrics
      if (!this.competitorData.growthMetrics.has(channelData.id)) {
        this.competitorData.growthMetrics.set(channelData.id, []);
      }

      const metrics = this.competitorData.growthMetrics.get(channelData.id);
      metrics.push({
        timestamp: new Date().toISOString(),
        followers: streamData.followers || channelData.followers,
        avgViewers: streamData.viewers || 0,
      });

      // Update market analysis
      if (streamData.game) {
        const currentTrend =
          this.competitorData.marketAnalysis.categoryTrends.get(streamData.game) || 0;
        this.competitorData.marketAnalysis.categoryTrends.set(streamData.game, currentTrend + 1);
      }

      await this.saveCompetitorData();
    } catch (error) {
      logger.error({
        message: 'Error updating channel data',
        channel,
        error: error.message,
      });
      throw new Error(`Failed to update channel data: ${error.message}`);
    }
  }

  /**
   * Generate insights from tracked channels
   * @param {Object} twitchClient - Initialized Twitch client
   * @returns {Promise<string>} Formatted insights
   */
  async generateInsights(twitchClient) {
    try {
      logger.debug('Generating insights', {
        trackedChannels: this.competitorData?.trackedChannels?.length || 0,
        hasCompetitorData: !!this.competitorData,
      });

      if (!this.competitorData) {
        throw new Error('No competitor data available');
      }

      if (!Array.isArray(this.competitorData.trackedChannels)) {
        throw new Error('Invalid tracked channels data');
      }

      if (this.competitorData.trackedChannels.length === 0) {
        return 'No channels are currently being tracked. Use !track [channel] to start tracking channels!';
      }

      if (!twitchClient) {
        throw new Error('Twitch client not initialized');
      }

      return await competitorManager.getInsights(twitchClient);
    } catch (error) {
      logger.error({
        message: 'Error generating insights',
        error: error.message,
      });
      throw new Error(`Unable to generate insights: ${error.message}`);
    }
  }

  /**
   * Get content suggestions based on competitor analysis
   * @param {Object} twitchClient - Initialized Twitch client
   * @returns {Promise<string>} Formatted suggestions
   */
  async getSuggestions(twitchClient) {
    try {
      logger.debug('Getting suggestions', {
        trackedChannels: this.competitorData?.trackedChannels?.length || 0,
        categoryTrends: this.competitorData?.marketAnalysis?.categoryTrends?.size || 0,
      });

      if (
        !this.competitorData?.trackedChannels ||
        !Array.isArray(this.competitorData.trackedChannels)
      ) {
        return 'No tracked channels data available. Use !track [channel] to start tracking channels!';
      }

      if (this.competitorData.trackedChannels.length === 0) {
        return 'No channels are currently being tracked. Use !track [channel] to start tracking channels!';
      }

      if (!twitchClient) {
        throw new Error('Twitch client not initialized');
      }

      const channelData = this.competitorData.trackedChannels
        .filter((ch) => ch?.displayName)
        .map(
          (ch) =>
            `- ${ch.displayName}: ${ch.category || 'Unknown'} (${ch.followers || 0} followers)`
        )
        .join('\n');

      const categoryTrends = this.competitorData.marketAnalysis?.categoryTrends
        ? Array.from(this.competitorData.marketAnalysis.categoryTrends.entries())
            .sort(([, a], [, b]) => b - a)
            .map(([category, count]) => `- ${category}: ${count} streams`)
            .join('\n')
        : 'No category trends available';

      const prompt = `Based on this competitor data, suggest content strategies:
      Tracked Channels:
      ${channelData}
      
      Category Trends:
      ${categoryTrends}
      
      Focus on:
      1. Most successful categories
      2. Follower growth patterns
      3. Content opportunities
      
      Keep suggestions concise and actionable.`;

      const suggestions = await generateResponse(prompt);

      if (!suggestions) {
        throw new Error('Failed to generate suggestions from analysis');
      }

      return suggestions;
    } catch (error) {
      logger.error({
        message: 'Error getting suggestions',
        error: error.message,
      });
      throw new Error(`Unable to generate suggestions: ${error.message}`);
    }
  }

  /**
   * Get list of tracked channels
   * @returns {string[]} Array of channel names
   */
  getTrackedChannels() {
    try {
      if (!this.competitorData?.trackedChannels) {
        logger.debug('No tracked channels found');
        return [];
      }

      if (!Array.isArray(this.competitorData.trackedChannels)) {
        throw new Error('Invalid tracked channels data structure');
      }

      const channels = this.competitorData.trackedChannels
        .map((channel) => channel.displayName)
        .filter(Boolean);

      logger.debug('Retrieved tracked channels', {
        count: channels.length,
        channels,
      });

      return channels;
    } catch (error) {
      logger.error({
        message: 'Error getting tracked channels',
        error: error.message,
      });
      throw new Error('Failed to get tracked channels');
    }
  }

  /**
   * Update all tracked channels
   * @param {Object} twitchClient - Initialized Twitch client
   * @returns {Promise<void>}
   */
  async updateAllChannels(twitchClient) {
    try {
      logger.debug('Starting competitor channels update');

      if (!twitchClient) {
        throw new Error('Twitch client not initialized');
      }

      if (!this.competitorData?.trackedChannels || !Array.isArray(this.competitorData.trackedChannels)) {
        throw new Error('Invalid tracked channels data structure');
      }

      // Process channels in batches
      for (let i = 0; i < this.competitorData.trackedChannels.length; i += BATCH_SIZE) {
        const batch = this.competitorData.trackedChannels.slice(i, i + BATCH_SIZE);

        // Process batch concurrently
        const batchPromises = batch.map((channel) =>
          this.fetchChannelData(channel.username, twitchClient)
            .then(async (streamData) => {
              if (streamData) {
                await this.updateChannelData(channel.username, streamData);
              }
            })
            .catch((error) => {
              logger.error({
                message: 'Error updating channel',
                channel: channel.username,
                error: error.message,
              });
              // Don't throw here to allow other channels to update
            })
        );

        await Promise.all(batchPromises).catch((error) => {
          logger.error({
            message: 'Error processing batch',
            error: error.message,
          });
          // Continue with next batch
        });

        // Add delay between batches
        if (i + BATCH_SIZE < this.competitorData.trackedChannels.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      logger.info(`Updated ${this.competitorData.trackedChannels.length} competitor channels`);
      await this.saveCompetitorData();
    } catch (error) {
      logger.error({
        message: 'Error in updateAllChannels',
        error: error.message,
      });
      // Re-throw with more context
      throw new Error(`Failed to update competitor channels: ${error.message}`);
    }
  }

  /**
   * Fetch channel data from Twitch API
   * @param {string} channelName - Channel name
   * @param {Object} twitchClient - Initialized Twitch client
   * @returns {Promise<Object|null>} Channel data
   * @private
   */
  async fetchChannelData(channelName, twitchClient) {
    try {
      const cacheKey = `channel_${channelName}`;
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }

      if (!twitchClient) {
        throw new Error('Twitch client not initialized');
      }

      const stream = await limiter.schedule(() =>
        twitchClient.apiClient.streams.getStreamByUserName(channelName)
      );

      if (stream) {
        const data = {
          user_login: stream.userName,
          user_name: stream.userName,
          game_name: stream.gameName,
          title: stream.title,
          viewer_count: stream.viewerCount,
          started_at: stream.startDate,
          tags: stream.tags,
        };

        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now(),
        });

        return data;
      }

      return null;
    } catch (error) {
      logger.error({
        message: 'Error fetching channel data',
        channel: channelName,
        error: error.message,
      });
      return null;
    }
  }
}

// Export singleton instance
export default new CompetitorAnalysis();
