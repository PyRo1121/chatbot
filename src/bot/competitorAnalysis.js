import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import logger from '../utils/logger.js';
import { generateResponse } from '../utils/deepseek.js';
import competitorManager from './competitorManager.js';

class CompetitorAnalysis {
  constructor() {
    this.competitorData = this.loadCompetitorData();
    this.initializeTracking();
  }

  loadCompetitorData() {
    try {
      const data = readFileSync(join(process.cwd(), 'src/bot/competitor_data.json'), 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error loading competitor data:', error);
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
      // Create the file with default data
      writeFileSync(
        join(process.cwd(), 'src/bot/competitor_data.json'),
        JSON.stringify(defaultData, null, 2)
      );
      return defaultData;
    }
  }

  saveCompetitorData() {
    try {
      writeFileSync(
        join(process.cwd(), 'src/bot/competitor_data.json'),
        JSON.stringify(this.competitorData, null, 2)
      );
    } catch (error) {
      logger.error('Error saving competitor data:', error);
    }
  }

  initializeTracking() {
    // Ensure trackedChannels is an array
    if (!Array.isArray(this.competitorData.trackedChannels)) {
      this.competitorData.trackedChannels = [];
      this.saveCompetitorData();
    }
  }

  async trackChannel(channel) {
    try {
      const channelName = channel.toLowerCase();
      const existingChannel = this.competitorData.trackedChannels.find(
        (ch) => ch.username.toLowerCase() === channelName
      );
      if (existingChannel) {
        return `@${existingChannel.displayName} is already being tracked!`;
      }

      // Add new channel to array
      this.competitorData.trackedChannels.push({
        username: channelName,
        displayName: channel, // Keep original casing
        category: '',
        followers: 0,
        streamFrequency: 0,
        contentTypes: [],
        addedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });

      this.saveCompetitorData();
      return `Now tracking ${channel}! Use !insights to see analytics.`;
    } catch (error) {
      logger.error('Error tracking channel:', error);
      return `Failed to track ${channel}. Please try again later.`;
    }
  }

  async untrackChannel(channel) {
    try {
      const channelName = channel.toLowerCase();
      const channelIndex = this.competitorData.trackedChannels.findIndex(
        (ch) => ch.username.toLowerCase() === channelName
      );
      if (channelIndex === -1) {
        return `@${channel} is not being tracked!`;
      }

      const { displayName } = this.competitorData.trackedChannels[channelIndex];
      this.competitorData.trackedChannels.splice(channelIndex, 1);
      this.saveCompetitorData();
      return `Stopped tracking @${displayName}!`;
    } catch (error) {
      logger.error('Error untracking channel:', error);
      return `Failed to untrack ${channel}. Please try again later.`;
    }
  }

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
      if (!this.competitorData.growthMetrics[channelData.id]) {
        this.competitorData.growthMetrics[channelData.id] = [];
      }

      this.competitorData.growthMetrics[channelData.id].push({
        timestamp: new Date().toISOString(),
        followers: streamData.followers || channelData.followers,
        avgViewers: streamData.viewers || 0,
      });

      // Update market analysis
      if (streamData.game) {
        if (!this.competitorData.marketAnalysis.categoryTrends[streamData.game]) {
          this.competitorData.marketAnalysis.categoryTrends[streamData.game] = 1;
        } else {
          this.competitorData.marketAnalysis.categoryTrends[streamData.game]++;
        }
      }

      this.saveCompetitorData();
    } catch (error) {
      logger.error('Error updating channel data:', error);
    }
  }

  async generateInsights() {
    try {
      logger.debug('Generating insights with data:', {
        trackedChannels: this.competitorData?.trackedChannels || [],
        hasCompetitorData: !!this.competitorData,
        hasTrackedChannels: !!this.competitorData?.trackedChannels,
        trackedChannelsLength: this.competitorData?.trackedChannels?.length || 0,
      });

      // Validate competitor data
      if (!this.competitorData) {
        logger.warn('No competitor data available');
        return 'No competitor data available. Please try again later.';
      }

      // Validate tracked channels
      if (!Array.isArray(this.competitorData.trackedChannels)) {
        logger.warn('trackedChannels is not an array:', this.competitorData.trackedChannels);
        return 'Error: Invalid tracked channels data. Please try again later.';
      }

      if (this.competitorData.trackedChannels.length === 0) {
        logger.info('No channels being tracked');
        return 'No channels are currently being tracked. Use !track [channel] to start tracking channels!';
      }

      // Generate insights
      const insights = [];
      for (const channel of this.competitorData.trackedChannels) {
        if (!channel?.displayName) {
          logger.warn('Invalid channel data:', channel);
          continue;
        }

        logger.debug('Processing channel data:', { channel });
        insights.push(
          `@${channel.displayName}: Category: ${channel.category || 'Unknown'} | Followers: ${channel.followers || 0}`
        );
      }

      if (insights.length === 0) {
        logger.warn('No valid insights generated');
        return 'Unable to generate insights from tracked channels. Please try again later.';
      }

      const result = insights.join(' | ');
      logger.debug('Generated insights:', { result });
      return result;
    } catch (error) {
      logger.error('Error generating insights:', error);
      return 'Unable to generate competitor insights at this time.';
    }
  }

  async getSuggestions() {
    try {
      logger.debug('Getting suggestions with data:', {
        trackedChannels: this.competitorData?.trackedChannels?.length || 0,
        hasMarketAnalysis: !!this.competitorData?.marketAnalysis,
        categoryTrends: Object.keys(this.competitorData?.marketAnalysis?.categoryTrends || {})
          .length,
      });

      // Validate competitor data
      if (
        !this.competitorData?.trackedChannels ||
        !Array.isArray(this.competitorData.trackedChannels)
      ) {
        logger.warn('Invalid tracked channels data');
        return 'No tracked channels data available. Use !track [channel] to start tracking channels!';
      }

      if (this.competitorData.trackedChannels.length === 0) {
        logger.info('No channels being tracked');
        return 'No channels are currently being tracked. Use !track [channel] to start tracking channels!';
      }

      // Build channel data string
      const channelData = this.competitorData.trackedChannels
        .filter((ch) => ch?.displayName)
        .map(
          (ch) =>
            `- ${ch.displayName}: ${ch.category || 'Unknown'} (${ch.followers || 0} followers)`
        )
        .join('\n');

      // Build category trends string
      const categoryTrends = this.competitorData.marketAnalysis?.categoryTrends
        ? Object.entries(this.competitorData.marketAnalysis.categoryTrends)
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

      logger.debug('Generated prompt for suggestions');
      const suggestions = await generateResponse(prompt);

      if (!suggestions) {
        logger.warn('No suggestions generated from prompt');
        return 'Unable to generate suggestions at this time. Please try again later.';
      }

      logger.debug('Generated suggestions successfully');
      return suggestions;
    } catch (error) {
      logger.error('Error getting suggestions:', error);
      return 'Unable to generate suggestions at this time.';
    }
  }

  getTrackedChannels() {
    try {
      if (!this.competitorData?.trackedChannels) {
        logger.debug('No tracked channels found');
        return [];
      }

      if (!Array.isArray(this.competitorData.trackedChannels)) {
        logger.warn('trackedChannels is not an array:', this.competitorData.trackedChannels);
        return [];
      }

      const channels = this.competitorData.trackedChannels.map((channel) => channel.displayName);
      logger.debug('Retrieved tracked channels:', {
        count: channels.length,
        channels,
      });
      return channels;
    } catch (error) {
      logger.error('Error getting tracked channels:', error);
      return [];
    }
  }
}

export default new CompetitorAnalysis();
