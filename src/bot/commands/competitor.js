import logger from '../../utils/logger.js';
import competitorAnalysis from '../competitorAnalysis.js';
import { generateResponse } from '../../utils/perplexity.js';

export const competitorCommands = {
  handleTrack: async (client, channel, user, args) => {
    try {
      if (!args || args.length === 0) {
        return 'Please specify a channel to track!';
      }

      const targetChannel = args[0].replace('@', '');
      const result = await competitorAnalysis.trackChannel(targetChannel);
      return result;
    } catch (error) {
      logger.error('Error tracking channel:', error);
      return 'Error tracking channel. Please try again later.';
    }
  },

  handleUntrack: async (client, channel, user, args) => {
    try {
      if (!args || args.length === 0) {
        return 'Please specify a channel to untrack!';
      }

      const targetChannel = args[0].replace('@', '');
      const result = await competitorAnalysis.untrackChannel(targetChannel);
      return result;
    } catch (error) {
      logger.error('Error untracking channel:', error);
      return 'Error untracking channel. Please try again later.';
    }
  },

  handleInsights: async (client, channel, user) => {
    try {
      const insights = await competitorAnalysis.generateInsights();
      return insights;
    } catch (error) {
      logger.error('Error generating insights:', error);
      return 'Error generating competitor insights. Please try again later.';
    }
  },

  handleSuggestions: async (client, channel, user) => {
    try {
      const suggestions = await competitorAnalysis.getSuggestions();
      return suggestions;
    } catch (error) {
      logger.error('Error getting suggestions:', error);
      return 'Error generating suggestions. Please try again later.';
    }
  },

  handleTracked: async (client, channel, user) => {
    try {
      const trackedChannels = competitorAnalysis.getTrackedChannels();
      if (trackedChannels.length === 0) {
        return 'No channels are currently being tracked!';
      }
      return `Currently tracking: ${trackedChannels.join(', ')}`;
    } catch (error) {
      logger.error('Error getting tracked channels:', error);
      return 'Error retrieving tracked channels. Please try again later.';
    }
  },

  handleCompare: async (client, channel, user, args) => {
    try {
      if (!args || args.length === 0) {
        return 'Please specify a channel to compare with!';
      }

      const targetChannel = args[0].replace('@', '');
      const trackedChannels = competitorAnalysis.getTrackedChannels();

      if (!trackedChannels.includes(targetChannel.toLowerCase())) {
        return `${targetChannel} is not being tracked! Use !track ${targetChannel} first.`;
      }

      const prompt = `Compare these stream stats:
      Channel A (${process.env.TWITCH_CHANNEL}):
      ${JSON.stringify(await client.twitchApi.streams.getStreamByUserName(process.env.TWITCH_CHANNEL))}
      
      Channel B (${targetChannel}):
      ${JSON.stringify(await client.twitchApi.streams.getStreamByUserName(targetChannel))}
      
      Provide a brief comparison focusing on key metrics and potential improvements.
      Keep it concise, max 200 characters.`;

      const comparison = await generateResponse(prompt);
      return comparison || 'Unable to generate comparison at this time.';
    } catch (error) {
      logger.error('Error comparing channels:', error);
      return 'Error comparing channels. Please try again later.';
    }
  },

  handleAnalyze: async (client, channel, user, args) => {
    try {
      if (!args || args.length === 0) {
        return 'Please specify a channel to analyze!';
      }

      const targetChannel = args[0].replace('@', '');
      const trackedChannels = competitorAnalysis.getTrackedChannels();

      if (!trackedChannels.includes(targetChannel.toLowerCase())) {
        return `${targetChannel} is not being tracked! Use !track ${targetChannel} first.`;
      }

      const prompt = `Analyze this channel's performance:
      ${JSON.stringify(await client.twitchApi.streams.getStreamByUserName(targetChannel))}
      
      Provide insights on:
      1. Content strategy
      2. Engagement tactics
      3. Growth opportunities
      
      Keep it concise, max 200 characters.`;

      const analysis = await generateResponse(prompt);
      return analysis || 'Unable to generate analysis at this time.';
    } catch (error) {
      logger.error('Error analyzing channel:', error);
      return 'Error analyzing channel. Please try again later.';
    }
  },
};
