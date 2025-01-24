import logger from '../../utils/logger.js';
import getClient from '../twitchClient.js';
import tokenManager from '../../auth/tokenManager.js';

// Posts stats in chat every 30 minutes when stream is live
class StreamInsights {
  constructor() {
    this.api = null;
    this.sessionStats = {
      viewerSamples: [],
      peakViewers: 0,
      startTime: null,
      lastUpdate: 0,
    };
    this.UPDATE_INTERVAL = 30 * 60 * 1000; // 30 minutes between auto-posts
  }

  async init() {
    const client = await getClient();
    this.api = client.broadcasterApi; // Use broadcaster API for all endpoints since we need user context
    return this;
  }

  async getStreamInsights(channelName, forceUpdate = false) {
    try {
      // Rate limit updates to every minute unless forced
      if (!forceUpdate && Date.now() - this.sessionStats.lastUpdate < 60000) {
        return null; // Skip update if too soon
      }

      // Get broadcaster tokens to get the ID
      const tokens = await tokenManager.getBroadcasterTokens();

      // Get stream info using broadcaster API
      const stream = await this.api.streams.getStreamByUserId(tokens.userId);

      // Get stats using broadcaster API with retries
      let followers = 0;
      let subscriptions = 0;
      try {
        // Get followers and subscribers data with proper pagination and retries
        const [followersData, subsData] = await Promise.all([
          this.getFollowersWithRetry(tokens.userId),
          this.getSubscribersWithRetry(tokens.userId),
        ]);

        followers = followersData;
        subscriptions = subsData;
      } catch (error) {
        logger.error('Error getting channel stats:', error);
        // Use default values on error
        followers = 0;
        subscriptions = 0;
      }

      // Get game info using broadcaster API with retry
      let game = null;
      if (stream?.gameId) {
        try {
          game = await this.getGameWithRetry(stream.gameId);
        } catch (error) {
          logger.error('Error getting game info:', error);
          // Continue with null game info
        }
      }

      // Track viewer stats for this stream session
      if (stream) {
        const currentViewers = stream.viewerCount || 0;

        // Reset session if this is a new stream
        if (!this.sessionStats.startTime || stream.startDate !== this.sessionStats.startTime) {
          this.sessionStats = {
            viewerSamples: [],
            peakViewers: currentViewers,
            startTime: stream.startDate,
            lastUpdate: Date.now(),
          };
        }

        // Update session stats
        this.sessionStats.viewerSamples.push(currentViewers);
        this.sessionStats.peakViewers = Math.max(this.sessionStats.peakViewers, currentViewers);
        this.sessionStats.lastUpdate = Date.now();
      }

      // Calculate basic stats
      const stats = {
        currentViewers: stream?.viewerCount || 0,
        averageViewers:
          this.sessionStats.viewerSamples.length > 0
            ? Math.round(
                this.sessionStats.viewerSamples.reduce((a, b) => a + b, 0) /
                  this.sessionStats.viewerSamples.length
              )
            : 0,
        peakViewers: this.sessionStats.peakViewers,
        currentGame: game?.name || 'Not Live',
        startTime: stream?.startDate ? new Date(stream.startDate) : null,
        uptime: stream?.uptime ? Math.round(stream.uptime / (60 * 60)) : 0,
        followers: followers || 0,
        subscribers: subscriptions || 0,
      };

      // Get similar channels in current category if streaming using direct API
      let similarChannels = [];
      if (stream?.gameId && stream.gameId !== '') {
        // Get similar channels using broadcaster API with proper filters and retry
        const streams = await this.getStreamsWithRetry({
          gameId: stream.gameId,
          type: 'live',
          language: stream.language,
          limit: 10,
          // Only get actual broadcaster streams (affiliates and partners), not reruns or premieres
          userTypes: ['affiliate', 'partner'],
        });
        similarChannels = streams.data
          .filter(
            (s) =>
              s.userId !== tokens.userId &&
              s.viewerCount > 0 &&
              s.viewerCount < (stream.viewerCount * 2 || 100)
          )
          .slice(0, 3)
          .map((s) => s.userDisplayName);
      }

      // Generate insights
      const insights = {
        currentStats: {
          viewers: stats.currentViewers,
          avgViewers: stats.averageViewers,
          peakViewers: stats.peakViewers,
          game: stats.currentGame,
          uptime: stats.uptime,
          followers: stats.followers,
          subscribers: stats.subscribers,
        },
        recommendations: this.generateRecommendations(stats, similarChannels),
      };

      return insights;
    } catch (error) {
      logger.error('Error getting stream insights:', error);
      throw error;
    }
  }

  // Generic retry function
  async retryOperation(operation, defaultValue, maxRetries = 3) {
    const delays = Array.from({ length: maxRetries }, (_, i) => 1000 * (i + 1));
    let lastError = null;

    const attempts = delays.map(async (delay, index) => {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (index === delays.length - 1) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        return null;
      }
    });

    try {
      const results = await Promise.all(attempts);
      // Find the first successful result
      const result = results.find((r) => r !== null);
      return result ?? defaultValue;
    } catch {
      logger.error('Operation failed after retries:', lastError);
      return defaultValue;
    }
  }

  // Helper methods using retry logic
  // Helper methods using retry logic
  getFollowersWithRetry(userId, maxRetries = 3) {
    return this.retryOperation(
      () => this.api.channels.getChannelFollowerCount(userId),
      0,
      maxRetries
    );
  }

  async getSubscribersWithRetry(userId, maxRetries = 3) {
    return this.retryOperation(
      async () => {
        try {
          // Get broadcaster's subscribers using paginated endpoint
          const subscribers = await this.api.subscriptions
            .getSubscriptionsPaginated(userId)
            .getAll();
          return subscribers.length || 0;
        } catch (error) {
          logger.error('Error getting subscribers:', error);
          throw error;
        }
      },
      0,
      maxRetries
    );
  }

  getGameWithRetry(gameId, maxRetries = 3) {
    return this.retryOperation(() => this.api.games.getGameById(gameId), null, maxRetries);
  }

  getStreamsWithRetry(params, maxRetries = 3) {
    return this.retryOperation(() => this.api.streams.getStreams(params), { data: [] }, maxRetries);
  }

  generateRecommendations(stats, similarChannels) {
    const recommendations = [];

    // Network recommendations
    if (similarChannels.length > 0) {
      recommendations.push(`🎯 Similar channels in category: ${similarChannels.join(', ')}`);
    }

    // Stream status
    if (stats.currentViewers > 0) {
      recommendations.push(`👥 Current viewers: ${stats.currentViewers}`);
      recommendations.push(`📈 Average viewers: ${stats.averageViewers}`);
      recommendations.push(`⚡ Peak viewers: ${stats.peakViewers}`);
      recommendations.push(`💫 Followers: ${stats.followers}`);
      recommendations.push(`💜 Subscribers: ${stats.subscribers}`);
      if (stats.uptime > 0) {
        recommendations.push(`⏱️ Stream uptime: ${stats.uptime} hours`);
      }
    } else {
      recommendations.push('📊 Channel is currently offline');
    }

    return recommendations;
  }

  formatMessage(data) {
    // Format insights message
    const stats = [
      `👥 Current: ${data.currentStats.viewers}`,
      `📈 Avg: ${data.currentStats.avgViewers}`,
      `⚡ Peak: ${data.currentStats.peakViewers}`,
      `💫 Followers: ${data.currentStats.followers}`,
      `💜 Subs: ${data.currentStats.subscribers}`,
      `⏱️ Uptime: ${data.currentStats.uptime}h`,
    ].join(' | ');

    return `📊 Stream Analytics\n${stats}`;
  }

  formatDetailedMessage(data) {
    return `${this.formatMessage(data)}\n\n📋 Insights:\n${data.recommendations.join('\n')}`;
  }
}

// Create singleton instance
let insights = null;

// Initialize insights instance
async function getInsights() {
  if (!insights) {
    insights = await new StreamInsights().init();
  }
  return insights;
}

// Command handler - shows detailed stats
export async function handleStreamInsights(username, args, userLevel) {
  const insights = await getInsights();
  if (userLevel !== 'broadcaster') {
    return {
      success: false,
      message: 'This command is for the broadcaster only!',
    };
  }

  try {
    const data = await insights.getStreamInsights(username, true); // Force update for command

    if (!data) {
      return {
        success: false,
        message: 'Please wait a moment before requesting new insights.',
      };
    }

    return {
      success: true,
      message: insights.formatDetailedMessage(data),
      fullData: data,
    };
  } catch (error) {
    logger.error('Error getting stream insights:', error);
    // Use Twurple's error types for better error handling
    const isNoDataError =
      error.name === 'HelixResourceNotFoundError' ||
      error.name === 'HelixEndpointNotFoundError' ||
      error.response?.status === 404;

    return {
      success: false,
      message: isNoDataError
        ? 'No stream data available yet. Start streaming consistently and check back in a few days for personalized insights!'
        : 'Failed to get stream insights. Please try again later.',
    };
  }
}

// For periodic updates - shows brief stats every 30 minutes
export async function getPeriodicUpdate(username) {
  const insights = await getInsights();
  try {
    const data = await insights.getStreamInsights(username);

    if (!data) {
      return null; // Skip if too soon
    }

    return {
      success: true,
      message: insights.formatMessage(data),
      fullData: data,
    };
  } catch (error) {
    logger.error('Error getting periodic stream insights:', error);
    return null; // Skip on error
  }
}

export default StreamInsights;
