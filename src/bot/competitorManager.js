/**
 * @fileoverview Manages competitor tracking and analysis for Twitch channels
 * Implements rate limiting, caching, and efficient data management
 */

import logger from '../utils/logger.js';
import Bottleneck from 'bottleneck';
import { join } from 'path';
import { readFile, writeFile } from 'fs/promises';

// Constants
const RATE_LIMIT_CONFIG = {
  minTime: 1000, // Minimum time between requests
  maxConcurrent: 2, // Maximum concurrent requests
};

const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const BATCH_SIZE = 5; // Number of channels to process at once

// Rate limiter instance
const limiter = new Bottleneck(RATE_LIMIT_CONFIG);

/**
 * @typedef {Object} CompetitorStats
 * @property {number} averageViewers - Average viewer count
 * @property {number} peakViewers - Peak viewer count
 * @property {number} totalHours - Total hours streamed
 * @property {Array<{name: string, hours: number}>} topCategories - Top game categories
 * @property {Object|null} lastStream - Last stream data
 */

/**
 * @typedef {Object} CompetitorData
 * @property {string} id - Twitch user ID
 * @property {string} displayName - Channel display name
 * @property {CompetitorStats} stats - Channel statistics
 * @property {number} lastUpdated - Timestamp of last update
 */

class CompetitorManager {
  constructor() {
    /** @private */
    this.competitorData = {
      trackedChannels: new Map(), // channelName -> CompetitorData
      insights: [],
      suggestions: [],
      cache: new Map(), // Cached API responses
    };

    this.dataPath = join(process.cwd(), 'src/bot/competitor_data.json');
    this.loadData();

    // Start periodic cleanup
    setInterval(() => this.cleanupCache(), CACHE_DURATION);
  }

  /**
   * Load data from JSON file
   * @private
   */
  async loadData() {
    try {
      const data = JSON.parse(await readFile(this.dataPath, 'utf8'));

      // Convert tracked channels array to Map
      this.competitorData.trackedChannels = new Map(
        (data.trackedChannels || []).map(channel => [
          channel.username.toLowerCase(),
          {
            id: channel.id || '',  // This might be empty initially
            displayName: channel.displayName,
            stats: {
              averageViewers: channel.averageViewers || 0,
              peakViewers: channel.peakViewers || 0,
              totalHours: channel.totalHours || 0,
              topCategories: channel.contentTypes || [],
              lastStream: null,
            },
            lastUpdated: new Date(channel.lastUpdated).getTime(),
          }
        ])
      );

      logger.info('Loaded competitor data from file');
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.info('No existing competitor data file, creating new one');
        await this.saveData();
      } else {
        logger.error({
          message: 'Error loading competitor data',
          error: error.message,
        });
      }
    }
  }

  /**
   * Save data to JSON file
   * @private
   */
  async saveData() {
    try {
      // Convert Map back to array for storage
      const trackedChannelsArray = Array.from(this.competitorData.trackedChannels.entries()).map(
        ([username, data]) => ({
          username,
          id: data.id, // Store the Twitch user ID
          displayName: data.displayName,
          category: data.stats.lastStream?.game || '',
          followers: 0,
          streamFrequency: 0,
          contentTypes: data.stats.topCategories,
          addedAt: new Date(data.lastUpdated).toISOString(),
          lastUpdated: new Date(data.lastUpdated).toISOString(),
        })
      );

      const data = {
        trackedChannels: trackedChannelsArray,
        marketAnalysis: {
          categoryTrends: {},
          peakTimes: {},
          contentTypes: {},
        },
        growthMetrics: {},
        lastUpdated: new Date().toISOString(),
      };

      logger.debug('Saving competitor data:', {
        channelCount: trackedChannelsArray.length,
        channels: trackedChannelsArray.map(ch => ({
          username: ch.username,
          id: ch.id,
          displayName: ch.displayName,
        })),
      });

      await writeFile(this.dataPath, JSON.stringify(data, null, 2));
      logger.info('Saved competitor data to file');
    } catch (error) {
      logger.error({
        message: 'Error saving competitor data',
        error: error.message,
      });
    }
  }

  /**
   * Clean up expired cache entries
   * @private
   */
  cleanupCache() {
    const now = Date.now();
    for (const [key, { timestamp }] of this.competitorData.cache) {
      if (now - timestamp > CACHE_DURATION) {
        this.competitorData.cache.delete(key);
      }
    }
  }

  /**
   * Track a new competitor channel
   * @param {Object} twitchClient - Twitch API client
   * @param {string} channelName - Channel name to track
   * @returns {Promise<string>} Status message
   */
  async trackChannel(twitchClient, channelName) {
    try {
      if (!channelName?.trim()) {
        throw new Error('Invalid channel name');
      }

      const normalizedName = channelName.toLowerCase();

      if (this.competitorData.trackedChannels.has(normalizedName)) {
        return `@${channelName} is already being tracked!`;
      }

      // Use the correct Twitch API client method
      const channelInfo = await limiter.schedule(async () => {
        const user = await limiter.schedule(() =>
          twitchClient.apiClient.users.getUserByName(normalizedName),
        );
        if (!user) {
          return null;
        }
        return {
          id: user.id,
          displayName: user.displayName,
        };
      });

      if (!channelInfo) {
        throw new Error(`Channel not found: ${channelName}`);
      }

      this.competitorData.trackedChannels.set(normalizedName, {
        id: channelInfo.id,
        displayName: channelInfo.displayName,
        stats: {
          averageViewers: 0,
          peakViewers: 0,
          totalHours: 0,
          topCategories: [],
          lastStream: null,
        },
        lastUpdated: Date.now(),
      });

      await this.saveData();

      logger.info({
        message: 'Started tracking competitor',
        channel: channelName,
        id: channelInfo.id,
      });

      return `Now tracking @${channelInfo.displayName}! Use !insights to see analytics.`;
    } catch (error) {
      logger.error({
        message: 'Error tracking channel',
        channel: channelName,
        error: error.message,
      });
      throw new Error(`Failed to track channel: ${error.message}`);
    }
  }

  /**
   * Stop tracking a competitor channel
   * @param {string} channelName - Channel to untrack
   * @returns {string} Status message
   */
  async untrackChannel(channelName) {
    try {
      const normalizedName = channelName.toLowerCase();
      const channel = this.competitorData.trackedChannels.get(normalizedName);

      if (!channel) {
        return `@${channelName} is not being tracked!`;
      }

      this.competitorData.trackedChannels.delete(normalizedName);
      await this.saveData();

      logger.info({
        message: 'Stopped tracking competitor',
        channel: channelName,
      });

      return `Stopped tracking @${channel.displayName}!`;
    } catch (error) {
      logger.error({
        message: 'Error untracking channel',
        channel: channelName,
        error: error.message,
      });
      throw new Error(`Failed to untrack channel: ${error.message}`);
    }
  }

  /**
   * Ensure all tracked channels have Twitch user IDs
   * @param {Object} twitchClient - Twitch API client
   * @private
   */
  async ensureUserIds(twitchClient) {
    try {
      logger.debug('Checking Twitch user IDs for tracked channels');
      const updates = [];
      for (const [username, data] of this.competitorData.trackedChannels.entries()) {
        logger.debug('Checking channel:', { username, hasId: !!data.id });
        if (!data.id) {
          try {
            const user = await limiter.schedule(() =>
              twitchClient.apiClient.users.getUserByName(username),
            );
            
            if (user) {
              data.id = user.id;
              updates.push(username);
              logger.debug('Updated user ID:', { username, id: user.id });
            } else {
              logger.warn(`Could not find Twitch user ID for ${username}`);
            }
          } catch (error) {
            logger.warn({
              message: 'Error fetching user ID',
              username,
              error: error.message,
            });
          }
        }
      }

      if (updates.length > 0) {
        await this.saveData();
        logger.info(`Updated Twitch user IDs for ${updates.length} channels:`, updates);
      }
    } catch (error) {
      logger.error('Error ensuring user IDs:', error);
      throw error; // Re-throw the error to be handled by the caller
    }
  }

  /**
   * Get insights about tracked competitors
   * @param {Object} twitchClient - Twitch API client
   * @returns {Promise<string>} Formatted insights
   */
  async getInsights(twitchClient) {
    try {
      if (!this.competitorData.trackedChannels.size) {
        return 'No channels are currently being tracked. Use !track [channel] to start tracking channels!';
      }

      logger.debug('Getting insights for tracked channels:', {
        channelCount: this.competitorData.trackedChannels.size,
        channels: Array.from(this.competitorData.trackedChannels.entries()).map(([name, data]) => ({
          name,
          id: data.id,
          displayName: data.displayName,
        })),
      });

      // Ensure all channels have Twitch user IDs
      await this.ensureUserIds(twitchClient);

      const insights = [];
      const channels = Array.from(this.competitorData.trackedChannels.entries());

      // Process in batches to respect rate limits
      for (let i = 0; i < channels.length; i += BATCH_SIZE) {
        const batch = channels.slice(i, i + BATCH_SIZE);
        const streamPromises = batch.map(async ([channelName, data]) => {
          try {
            if (!data.id) {
              logger.warn(`No Twitch user ID for ${channelName}, skipping`);
              return;
            }

            logger.debug('Fetching stream data:', { channelName, id: data.id });
            const stream = await limiter.schedule(() =>
              limiter.schedule(() =>
                twitchClient.apiClient.streams.getStreamByUserId(data.id)
              )
            );

            if (stream) {
              logger.debug('Stream data received:', {
                channelName,
                viewerCount: stream.viewerCount,
                gameName: stream.gameName,
              });
              insights.push(
                `${data.displayName}: ${stream.viewerCount} viewers playing ${stream.gameName}`
              );
            } else {
              logger.debug(`No live stream for ${channelName}`);
            }
          } catch (error) {
            logger.warn({
              message: 'Error fetching stream data',
              channel: channelName,
              error: error.message,
            });
          }
        });

        await Promise.all(streamPromises);

        // Add delay between batches
        if (i + BATCH_SIZE < channels.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      return insights.length > 0
        ? `Competitor Insights:\n${insights.join('\n')}`
        : 'No live channels found among tracked competitors.';
    } catch (error) {
      logger.error({
        message: 'Error getting insights',
        error: error.message,
        stack: error.stack,
      });
      throw new Error('Failed to get competitor insights');
    }
  }

  /**
   * Process stream results and generate insights
   * @private
   * @param {Array} results - Stream results
   * @param {Array} insights - Insights array to populate
   */
  processStreamResults(results, insights) {
    for (const { channelName, data, stream } of results) {
      if (!stream) {
        continue;
      }

      // Update stats
      this.updateChannelStats(data, stream);

      // Generate insights
      if (stream.viewers > data.stats.averageViewers * 1.5) {
        insights.push(
          `${channelName} has ${stream.viewers} viewers ` +
            `(50% above average) playing ${stream.game_name}`
        );
      }
    }
  }

  /**
   * Update channel statistics
   * @private
   * @param {CompetitorData} data - Channel data
   * @param {Object} stream - Stream data
   */
  updateChannelStats(data, stream) {
    data.stats.peakViewers = Math.max(data.stats.peakViewers, stream.viewers);
    data.stats.lastStream = {
      game: stream.game_name,
      title: stream.title,
      viewers: stream.viewers,
      startedAt: stream.started_at,
    };

    // Update categories
    const categoryIndex = data.stats.topCategories.findIndex((c) => c.name === stream.game_name);

    if (categoryIndex >= 0) {
      data.stats.topCategories[categoryIndex].hours += 1;
    } else {
      data.stats.topCategories.push({ name: stream.game_name, hours: 1 });
    }

    data.stats.topCategories.sort((a, b) => b.hours - a.hours);

    if (stream.game_name) {
      const currentTrend =
        this.competitorData.marketAnalysis.categoryTrends.get(stream.game_name) || 0;
      this.competitorData.marketAnalysis.categoryTrends.set(stream.game_name, currentTrend + 1);
    }
  }

  /**
   * Get suggestions based on competitor analysis
   * @param {Object} twitchClient - Twitch API client
   * @returns {Promise<string>} Formatted suggestions
   */
  async getSuggestions(twitchClient) {
    try {
      const suggestions = [];
      const allCategories = new Map();

      const channels = Array.from(this.competitorData.trackedChannels.entries());
      const batchSize = 5;

      for (let i = 0; i < channels.length; i += batchSize) {
        const batch = channels.slice(i, i + batchSize);
        const streamPromises = batch.map(async ([_, data]) => {
          const cacheKey = `stream_${data.id}`;
          const cached = this.competitorData.cache.get(cacheKey);

          if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            return cached.data;
          }

          const stream = await limiter.schedule(() =>
            limiter.schedule(() =>
              twitchClient.apiClient.streams.getStreamByUserId(data.id)
            )
          );

          if (stream) {
            this.competitorData.cache.set(cacheKey, {
              data: stream,
              timestamp: Date.now(),
            });
          }

          return stream;
        });

        const streams = await Promise.all(streamPromises);
        this.processStreamsForSuggestions(streams, allCategories);

        if (i + batchSize < channels.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      this.generateSuggestions(suggestions, allCategories);

      return suggestions.join('\n') || 'No suggestions available at this time';
    } catch (error) {
      logger.error({
        message: 'Error getting suggestions',
        error: error.message,
      });
      throw new Error('Failed to get competitor suggestions');
    }
  }

  /**
   * Process streams for generating suggestions
   * @private
   * @param {Array} streams - Stream data
   * @param {Map} allCategories - Categories map
   */
  processStreamsForSuggestions(streams, allCategories) {
    streams.forEach((stream) => {
      if (!stream) {
        return;
      }
      const currentViewers = allCategories.get(stream.game_name) || 0;
      allCategories.set(stream.game_name, currentViewers + stream.viewers);
    });
  }

  /**
   * Generate suggestions based on analysis
   * @private
   * @param {Array} suggestions - Suggestions array to populate
   * @param {Map} allCategories - Categories map
   */
  generateSuggestions(suggestions, allCategories) {
    const trendingCategories = Array.from(allCategories.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (trendingCategories.length) {
      suggestions.push('Trending categories among competitors:');
      trendingCategories.forEach(([game, viewers]) => {
        suggestions.push(`- ${game} (${viewers} total viewers)`);
      });
    }

    const successfulTitles = Array.from(this.competitorData.trackedChannels.values())
      .filter((data) => data.stats.lastStream?.viewers > data.stats.averageViewers)
      .map((data) => data.stats.lastStream.title)
      .slice(0, 3);

    if (successfulTitles.length) {
      suggestions.push('\nSuccessful stream titles:');
      successfulTitles.forEach((title) => {
        suggestions.push(`- "${title}"`);
      });
    }
  }

  /**
   * Get list of tracked channels
   * @returns {string} Formatted list of tracked channels
   */
  getTrackedChannels() {
    try {
      const channels = Array.from(this.competitorData.trackedChannels.entries())
        .map(([name, data]) => {
          const { lastStream } = data.stats;
          return `${name} (${lastStream ? `Last seen: ${lastStream.game}` : 'Offline'})`;
        })
        .join('\n');

      return channels ? `Tracked Channels:\n${channels}` : 'No channels being tracked';
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
   * @param {Object} twitchClient - Twitch API client
   * @returns {Promise<void>}
   */
  async updateAllChannels(twitchClient) {
    try {
      const channels = Array.from(this.competitorData.trackedChannels.entries());
      const batchSize = 5;

      for (let i = 0; i < channels.length; i += batchSize) {
        const batch = channels.slice(i, i + batchSize);
        const updatePromises = batch.map(async ([_, data]) => {
          const stream = await limiter.schedule(() =>
            limiter.schedule(() =>
              twitchClient.apiClient.streams.getStreamByUserId(data.id)
            )
          );

          if (stream) {
            this.updateChannelStats(data, stream);
            this.updateAverageViewers(data, stream);
          }
          data.lastUpdated = Date.now();
        });

        await Promise.all(updatePromises);

        if (i + batchSize < channels.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      logger.info('Updated competitor stats');
    } catch (error) {
      logger.error({
        message: 'Error updating competitor stats',
        error: error.message,
      });
      throw new Error('Failed to update competitor stats');
    }
  }

  /**
   * Update average viewers for a channel
   * @private
   * @param {CompetitorData} data - Channel data
   * @param {Object} stream - Stream data
   */
  updateAverageViewers(data, stream) {
    const oldAvg = data.stats.averageViewers;
    const totalStreams = Math.floor(data.stats.totalHours) + 1;
    data.stats.averageViewers = Math.round(
      (oldAvg * (totalStreams - 1) + stream.viewers) / totalStreams
    );
    data.stats.totalHours++;
  }
}

// Export singleton instance
export default new CompetitorManager();
