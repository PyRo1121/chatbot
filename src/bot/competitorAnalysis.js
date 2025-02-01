import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import logger from '../utils/logger.js';
import { generateResponse } from '../utils/perplexity.js';

class CompetitorAnalysis {
  constructor() {
    this.competitorData = this.loadCompetitorData();
    this.trackedChannels = new Set();
    this.initializeTracking();
  }

  loadCompetitorData() {
    try {
      const data = readFileSync(
        join(process.cwd(), 'src/bot/competitor_data.json'),
        'utf8'
      );
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error loading competitor data:', error);
      const defaultData = {
        trackedChannels: {},
        insights: [],
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
    Object.keys(this.competitorData.trackedChannels || {}).forEach(
      (channel) => {
        this.trackedChannels.add(channel.toLowerCase());
      }
    );
  }

  async trackChannel(channel) {
    try {
      const channelName = channel.toLowerCase();
      if (this.trackedChannels.has(channelName)) {
        return `${channel} is already being tracked!`;
      }

      this.trackedChannels.add(channelName);
      this.competitorData.trackedChannels[channelName] = {
        startedTracking: new Date().toISOString(),
        streams: [],
        categories: {},
        viewerStats: {
          peak: 0,
          average: 0,
        },
        engagement: {
          chatActivity: 0,
          commands: {},
        },
      };

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
      if (!this.trackedChannels.has(channelName)) {
        return `${channel} is not being tracked!`;
      }

      this.trackedChannels.delete(channelName);
      delete this.competitorData.trackedChannels[channelName];
      this.saveCompetitorData();
      return `Stopped tracking ${channel}!`;
    } catch (error) {
      logger.error('Error untracking channel:', error);
      return `Failed to untrack ${channel}. Please try again later.`;
    }
  }

  async updateChannelData(channel, streamData) {
    try {
      const channelName = channel.toLowerCase();
      if (!this.trackedChannels.has(channelName)) {
        return;
      }

      const channelData = this.competitorData.trackedChannels[channelName];
      channelData.streams.push({
        timestamp: new Date().toISOString(),
        viewers: streamData.viewers,
        game: streamData.game,
        title: streamData.title,
        chatActivity: streamData.chatActivity,
      });

      // Update categories
      channelData.categories[streamData.game] =
        (channelData.categories[streamData.game] || 0) + 1;

      // Update viewer stats
      channelData.viewerStats.peak = Math.max(
        channelData.viewerStats.peak,
        streamData.viewers
      );
      channelData.viewerStats.average =
        channelData.streams.reduce((sum, stream) => sum + stream.viewers, 0) /
        channelData.streams.length;

      // Update engagement
      channelData.engagement.chatActivity += streamData.chatActivity;

      // Cleanup old data (keep last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      channelData.streams = channelData.streams.filter(
        (stream) => new Date(stream.timestamp) > thirtyDaysAgo
      );

      this.saveCompetitorData();
    } catch (error) {
      logger.error('Error updating channel data:', error);
    }
  }

  async generateInsights() {
    try {
      logger.debug('Generating insights with data:', {
        trackedChannels: Array.from(this.trackedChannels),
        hasCompetitorData: !!this.competitorData,
        hasTrackedChannels: !!this.competitorData?.trackedChannels,
      });

      if (!this.competitorData?.trackedChannels) {
        logger.warn('No competitor data available');
        return 'No competitor insights available. Use !track [channel] to start tracking channels!';
      }

      const insights = [];
      for (const [channel, data] of Object.entries(
        this.competitorData.trackedChannels
      )) {
        logger.debug('Processing channel data:', { channel, data });

        if (!data?.categories) {
          logger.warn(`Missing categories data for channel: ${channel}`);
          continue;
        }

        const topCategories = Object.entries(data.categories)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([game, count]) => `${game}(${count})`);

        insights.push(
          `${channel}: Peak: ${data.viewerStats?.peak || 0} | Avg: ${Math.round(
            data.viewerStats?.average || 0
          )} | Top Games: ${topCategories.join(', ') || 'None'}`
        );
      }

      if (insights.length === 0) {
        return 'No competitor insights available. Use !track [channel] to start tracking channels!';
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
      const prompt = `Based on this competitor data, suggest content strategies:
      ${JSON.stringify(this.competitorData.trackedChannels, null, 2)}
      
      Focus on:
      1. Popular categories/games
      2. Successful stream titles
      3. Peak viewing times
      4. Engagement patterns
      
      Keep suggestions concise and actionable.`;

      const suggestions = await generateResponse(prompt);
      return suggestions || 'No suggestions available at this time.';
    } catch (error) {
      logger.error('Error getting suggestions:', error);
      return 'Unable to generate suggestions at this time.';
    }
  }

  getTrackedChannels() {
    return Array.from(this.trackedChannels);
  }
}

export default new CompetitorAnalysis();
