import logger from '../../utils/logger.js';
import enhancedAnalytics from '../enhancedAnalytics.js';
import contentManager from '../contentManager.js';
import streamSummary from '../streamSummary.js';
import AIService from '../../utils/aiService.js';

const aiService = new AIService(); // Create instance

// Stream Analytics Commands
export const analyticsCommands = {
  '!peak': () => {
    try {
      const performance = enhancedAnalytics.getStreamPerformance();
      const peakViewers = Math.max(
        ...Array.from(enhancedAnalytics.analyticsData.streamPerformance.values()).map(
          (data) => data.viewers || 0
        )
      );
      return `Peak Viewers: ${peakViewers} | Current Status: ${performance.current.status}`;
    } catch (error) {
      logger.error('Error getting peak viewers:', error);
      return 'Unable to get peak viewer data at this time.';
    }
  },

  '!growth': () => {
    try {
      const performance = enhancedAnalytics.getStreamPerformance();
      const { growth } = performance.predictions;
      const { recommendations } = performance;

      return `Growth Stats: Trend: ${growth.trend} | Rate: ${Math.round(growth.rate * 100)}% | Confidence: ${Math.round(growth.confidence * 100)}% | Recommendation: ${recommendations[0]?.suggestion || 'Keep up the good work!'}`;
    } catch (error) {
      logger.error('Error getting growth stats:', error);
      return 'Unable to get growth stats at this time.';
    }
  },

  '!trending': () => {
    try {
      const trends = contentManager.getContentRecommendations();
      return `Trending Content: ${trends.trending.map((t) => `${t.type} (${Math.round(t.engagement * 100)}% engagement)`).join(' | ')}`;
    } catch (error) {
      logger.error('Error getting trending segments:', error);
      return 'Unable to get trending segments at this time.';
    }
  },

  '!insights': () => {
    try {
      const performance = enhancedAnalytics.getStreamPerformance();
      const timeline = enhancedAnalytics.getEngagementTimeline('1h');
      const uniqueViewers = new Set(
        timeline.filter((e) => e.type === 'chat').map((e) => e.username)
      ).size;

      return `Stream Insights: Engagement: ${Math.round(performance.current.metrics.engagement * 100)}% | Unique Chatters: ${uniqueViewers} | Health: ${performance.current.status} | ${performance.recommendations[0]?.suggestion || ''}`;
    } catch (error) {
      logger.error('Error getting retention insights:', error);
      return 'Unable to get viewer retention insights at this time.';
    }
  },

  '!recap': async () => {
    try {
      const summary = await streamSummary.generateEndOfStreamSummary();
      return summary;
    } catch (error) {
      logger.error('Error generating recap:', error);
      return 'Unable to generate stream recap at this time.';
    }
  },

  '!highlight': async (description = '') => {
    try {
      const highlight = await contentManager.detectHighlight(
        enhancedAnalytics.getEngagementTimeline('5m')
      );

      if (highlight) {
        return `Highlight Created! Triggers: ${highlight.triggers.join(', ')} | Intensity: ${Math.round(highlight.analysis.intensity * 100)}%`;
      }
      return 'No significant highlight moment detected in the last 5 minutes.';
    } catch (error) {
      logger.error('Error creating highlight:', error);
      return 'Unable to create highlight at this time.';
    }
  },

  '!vibe': async () => {
    try {
      const timeline = enhancedAnalytics.getEngagementTimeline('5m');
      const chatMessages = timeline.filter((e) => e.type === 'chat');
      const analysis = await Promise.all(
        chatMessages.map((e) => aiService.analyzeMessage(e.data.message, e.username))
      );

      const avgSentiment =
        analysis.reduce((sum, a) => sum + (a?.sentiment || 0), 0) / analysis.length;
      let mood;
      if (avgSentiment > 0.3) {
        mood = 'Positive';
      } else if (avgSentiment < -0.3) {
        mood = 'Negative';
      } else {
        mood = 'Neutral';
      }
      let energy = 'Low';
      if (chatMessages.length > 10) {
        energy = 'High';
      } else if (chatMessages.length > 5) {
        energy = 'Medium';
      }

      return `Chat Vibe: ${mood} mood with ${energy} energy! Messages in last 5m: ${chatMessages.length}`;
    } catch (error) {
      logger.error('Error getting chat vibe:', error);
      return 'Unable to analyze chat vibe at this time.';
    }
  },

  '!schedule': () => {
    try {
      const performance = enhancedAnalytics.getStreamPerformance();
      const timeline = enhancedAnalytics.getEngagementTimeline('24h');
      const hourlyActivity = new Map();

      timeline.forEach((event) => {
        const hour = new Date(event.timestamp).getHours();
        hourlyActivity.set(hour, (hourlyActivity.get(hour) || 0) + 1);
      });

      const bestHours = Array.from(hourlyActivity.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([hour]) => `${hour}:00`);

      return `Best Streaming Times: ${bestHours.join(', ')} | Current Performance: ${performance.current.status}`;
    } catch (error) {
      logger.error('Error getting schedule recommendations:', error);
      return 'Unable to get schedule recommendations at this time.';
    }
  },
};

let twitchClient;

export function initializeAnalytics(client) {
  twitchClient = client;
}

// Helper function to get channel info using Twurple
export async function getChannelInfo(username = '') {
  try {
    if (!twitchClient?.twitchApi) {
      throw new Error('Twitch API not initialized');
    }

    const user = await twitchClient.twitchApi.users.getUserByName(username);
    if (!user) {
      return null;
    }

    const channel = await twitchClient.twitchApi.channels.getChannelInfo(user.id);
    const stream = await twitchClient.twitchApi.streams.getStreamByUserId(user.id);

    return {
      username: user.displayName,
      lastStream: stream?.startDate || null,
      category: channel.gameName || 'Unknown',
      title: channel.title || 'Unknown',
      id: user.id,
      profileImage: user.profilePictureUrl,
      description: channel.description || '',
    };
  } catch (error) {
    logger.error('Error getting channel info:', error);
    return null;
  }
}

// Helper function to get current viewer count using Twurple
export async function getCurrentViewerCount() {
  try {
    if (!twitchClient?.twitchApi) {
      throw new Error('Twitch API not initialized');
    }

    const stream = await twitchClient.twitchApi.streams.getStreamByUserId(
      twitchClient.configuration.userId
    );
    return stream?.viewerCount || 0;
  } catch (error) {
    logger.error('Error getting viewer count:', error);
    return 0;
  }
}

export default {
  ...analyticsCommands,
  initializeAnalytics,
};
