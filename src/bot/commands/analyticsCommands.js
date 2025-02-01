import streamMetrics from '../analytics/streamMetrics.js';
import engagementFeatures from '../analytics/engagementFeatures.js';
import contentOptimization from '../analytics/contentOptimization.js';
import communityFeatures from '../analytics/communityFeatures.js';
import logger from '../../utils/logger.js';

// Stream Analytics Commands
export const analyticsCommands = {
  '!peak': async () => {
    try {
      return await streamMetrics.getPeakViewers();
    } catch (error) {
      logger.error('Error getting peak viewers:', error);
      return 'Unable to get peak viewer data at this time.';
    }
  },

  '!growth': async () => {
    try {
      return await streamMetrics.getGrowthStats();
    } catch (error) {
      logger.error('Error getting growth stats:', error);
      return 'Unable to get growth stats at this time.';
    }
  },

  '!trending': async () => {
    try {
      return await streamMetrics.getTrendingSegments();
    } catch (error) {
      logger.error('Error getting trending segments:', error);
      return 'Unable to get trending segments at this time.';
    }
  },

  '!insights': async () => {
    try {
      return await streamMetrics.getRetentionInsights();
    } catch (error) {
      logger.error('Error getting retention insights:', error);
      return 'Unable to get viewer retention insights at this time.';
    }
  },

  // Viewer Engagement Commands
  '!recap': async () => {
    try {
      return await engagementFeatures.generateRecap();
    } catch (error) {
      logger.error('Error generating recap:', error);
      return 'Unable to generate stream recap at this time.';
    }
  },

  '!highlight': async (description = '') => {
    try {
      const result = await engagementFeatures.createHighlight(description);
      return result.success
        ? `Created highlight: ${result.title}`
        : 'Failed to create highlight.';
    } catch (error) {
      logger.error('Error creating highlight:', error);
      return 'Unable to create highlight at this time.';
    }
  },

  '!vibe': async () => {
    try {
      return await engagementFeatures.getChatVibe();
    } catch (error) {
      logger.error('Error getting chat vibe:', error);
      return 'Unable to analyze chat vibe at this time.';
    }
  },

  // Content Optimization Commands
  '!category': async () => {
    try {
      return await contentOptimization.getCategorySuggestions();
    } catch (error) {
      logger.error('Error getting category suggestions:', error);
      return 'Unable to get category suggestions at this time.';
    }
  },

  '!title': async (description = '') => {
    try {
      const currentCategory = contentOptimization.getCurrentCategory();
      return await contentOptimization.generateStreamTitle(
        currentCategory,
        description
      );
    } catch (error) {
      logger.error('Error generating title:', error);
      return 'Unable to generate stream title at this time.';
    }
  },

  '!schedule': async () => {
    try {
      return await contentOptimization.getScheduleRecommendations();
    } catch (error) {
      logger.error('Error getting schedule recommendations:', error);
      return 'Unable to get schedule recommendations at this time.';
    }
  },

  '!tags': async () => {
    try {
      const currentCategory = contentOptimization.getCurrentCategory();
      const currentTitle = contentOptimization.getCurrentTitle();
      return await contentOptimization.getTagRecommendations(
        currentCategory,
        currentTitle
      );
    } catch (error) {
      logger.error('Error getting tag recommendations:', error);
      return 'Unable to get tag recommendations at this time.';
    }
  },

  // Community Building Commands
  '!shoutout': async (username) => {
    if (!username) {
      return 'Usage: !shoutout @username';
    }
    try {
      // Remove @ symbol if present
      const cleanUsername = username.replace('@', '');
      // Get channel info (you'll need to implement this using Twitch API)
      const channelInfo = await getChannelInfo(cleanUsername);
      return await communityFeatures.generateEnhancedShoutout(
        username,
        channelInfo
      );
    } catch (error) {
      logger.error('Error generating shoutout:', error);
      return `Check out @${username}! They're awesome!`;
    }
  },

  '!raid': async () => {
    try {
      const currentCategory = contentOptimization.getCurrentCategory();
      const viewerCount = await getCurrentViewerCount(); // Implement this using Twitch API
      return await communityFeatures.getRaidSuggestions(
        currentCategory,
        viewerCount
      );
    } catch (error) {
      logger.error('Error getting raid suggestions:', error);
      return 'Unable to get raid suggestions at this time.';
    }
  },

  '!collab': async () => {
    try {
      const channelInfo = await getChannelInfo(); // Implement this using Twitch API
      return await communityFeatures.findCollaborationPartners(channelInfo);
    } catch (error) {
      logger.error('Error finding collaboration partners:', error);
      return 'Unable to find collaboration partners at this time.';
    }
  },

  '!network': async () => {
    try {
      return await communityFeatures.getNetworkingEffectiveness();
    } catch (error) {
      logger.error('Error getting networking effectiveness:', error);
      return 'Unable to analyze networking effectiveness at this time.';
    }
  },
};

let twitchClient;

export function initializeAnalytics(client) {
  twitchClient = client;
}

// Helper function to get channel info using Twurple
async function getChannelInfo(username = '') {
  try {
    const user = await twitchClient.twitchApi.users.getUserByName(username);
    if (!user) return null;

    const channel = await twitchClient.twitchApi.channels.getChannelInfo(user.id);
    const stream = await twitchClient.twitchApi.streams.getStreamByUserId(user.id);

    return {
      username: user.displayName,
      lastStream: stream?.startDate || null,
      category: channel.gameName || 'Unknown',
      title: channel.title || 'Unknown',
      id: user.id,
      profileImage: user.profilePictureUrl,
      description: channel.description || ''
    };
  } catch (error) {
    logger.error('Error getting channel info:', error);
    return null;
  }
}

// Helper function to get current viewer count using Twurple
async function getCurrentViewerCount() {
  try {
    const stream = await twitchClient.twitchApi.streams.getStreamByUserId(twitchClient.configuration.userId);
    return stream?.viewerCount || 0;
  } catch (error) {
    logger.error('Error getting viewer count:', error);
    return 0;
  }
}

export default {
  ...analyticsCommands,
  initializeAnalytics
};
