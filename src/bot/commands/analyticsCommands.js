/**
 * @fileoverview Analytics commands for Twitch bot with enhanced error handling and performance optimizations.
 * @module analyticsCommands
 */

import logger from '../../utils/logger.js';
import enhancedAnalytics from '../enhancedAnalytics.js';
import contentManager from '../contentManager.js';
import streamSummary from '../streamSummary.js';
import AIService from '../../utils/aiService.js';
import analytics from '../analytics.js';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { rateLimit } from '../../utils/rateLimiter.js';
import { sanitizeInput } from '../../utils/security.js';
import { CircuitBreaker } from '../../utils/circuitBreaker.js';
import analyticsData from '../analyticsData.js';

let twitchClient;
const API_TIMEOUT = 5000;
const CACHE_DURATION = 300000; // 5 minutes
const MAX_RETRIES = 3;
const BATCH_SIZE = 10;
const COOLDOWN_PERIOD = 5000; // Default cooldown of 5 seconds

// Caching and rate limiting
const analyticsCache = new Map();
const commandCooldowns = new Map();
const weakCache = new WeakMap();
const requestQueue = new Map();

// Circuit breakers for external services
const twitchCircuitBreaker = new CircuitBreaker('twitch-api', {
  failureThreshold: 5,
  resetTimeout: 60000,
});

const trackerCircuitBreaker = new CircuitBreaker('twitch-tracker', {
  failureThreshold: 3,
  resetTimeout: 120000,
});

// Add polyfill for AbortController if needed
const AbortController = globalThis.AbortController || require('abort-controller');

// Command-specific cooldown periods in seconds
const COMMAND_COOLDOWNS = {
    schedule: 10,
    vibe: 30,
    peak: 60,
    growth: 120,
    trending: 300,
    insights: 180,
    recap: 600,
    highlight: 120,
};

// Add command lock to prevent double execution
const commandLocks = new Map();

function acquireCommandLock(command) {
    if (commandLocks.get(command)) {
        return false;
    }
    commandLocks.set(command, true);
    setTimeout(() => commandLocks.delete(command), 1000); // Release lock after 1 second
    return true;
}

/**
 * Implements exponential backoff for API retries
 * @param {Function} fn - The function to retry
 * @param {number} retries - Number of retries remaining
 * @returns {Promise<any>}
 */
async function withRetry(fn, retries = MAX_RETRIES) {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) {
      throw error;
    }
    const delay = Math.min(1000 * Math.pow(2, MAX_RETRIES - retries), 10000);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1);
  }
}

/**
 * Batches multiple API requests together
 * @param {Array<Function>} requests - Array of request functions
 * @returns {Promise<Array>}
 */
async function batchRequests(requests) {
  const batches = [];
  for (let i = 0; i < requests.length; i += BATCH_SIZE) {
    batches.push(requests.slice(i, i + BATCH_SIZE));
  }

  const results = [];
  for (const batch of batches) {
    const batchResults = await Promise.all(batch.map((req) => withRetry(req)));
    results.push(...batchResults);
  }
  return results;
}

/**
 * Deduplicates identical requests within a time window
 * @param {string} key - Request identifier
 * @param {Function} request - The request function
 * @returns {Promise<any>}
 */
async function deduplicateRequest(key, request) {
  const existing = requestQueue.get(key);
  if (existing) {
    return existing;
  }

  const promise = request().finally(() => {
    requestQueue.delete(key);
  });
  requestQueue.set(key, promise);
  return promise;
}

export async function initializeAnalytics(client) {
  if (!client) {
    throw new Error('Client must be provided to initialize analytics');
  }

  // Validate required client properties
  if (!client.apiClient) {
    throw new Error('Client missing required property: apiClient');
  }

  if (!client.channel) {
    throw new Error('Client missing required property: channel');
  }

  // Store the client instance
  twitchClient = client;

  // Initialize analytics data system
  try {
    await analyticsData.initialize();
    logger.info('Analytics data system initialized');
  } catch (error) {
    logger.error('Failed to initialize analytics data system:', error);
    // Don't throw here - we can still function with live data only
  }

  // Log successful initialization with channel info
  const channelName = client.channel.replace('#', '');
  logger.info('Analytics initialized for channel:', channelName);

  // Validate API client access
  try {
    const user = await client.apiClient.users.getUserByName(channelName);
    if (user) {
      logger.info('Successfully validated API access for channel:', channelName);
      // Get initial channel stats and update analytics data
      const initialStats = await getChannelStats(channelName);
      if (initialStats) {
        await analyticsData.updateWithTwitchData({
          averageViewers: initialStats.currentViewers,
          maxViewers: initialStats.currentViewers,
          minutesStreamed: 0, // Will be updated during stream
          follows: initialStats.followers,
          uniqueViewers: 0, // Will be tracked during stream
          chatters: 0, // Will be tracked during stream
          chatMessages: 0, // Will be tracked during stream
          engagedViewers: 0, // Will be tracked during stream
        });
      }
    } else {
      logger.error('Could not validate channel through API:', channelName);
    }
  } catch (error) {
    logger.error('Error validating API access:', error);
    throw error;
  }
}

const aiService = new AIService(); // Create instance

// Rate limiting map to prevent command spam
const TRACKER_COOLDOWN = 300000; // 5 minutes cooldown for TwitchTracker
const trackerCache = new Map();

// Helper function to check if analytics is initialized
function isAnalyticsInitialized() {
  return twitchClient && twitchClient.apiClient;
}

// Utility function to check cooldown
function isOnCooldown(command) {
    const lastUsed = commandCooldowns.get(command);
    const now = Date.now();
    const cooldownTime = COMMAND_COOLDOWNS[command] * 1000 || COOLDOWN_PERIOD;
    if (lastUsed && now - lastUsed < cooldownTime) {
        return true;
    }
    // Set the cooldown timestamp before executing the command
    commandCooldowns.set(command, now);
    return false;
}

// Utility function to validate timeline data
function validateTimeline(timeline, minLength = 1) {
  return timeline && Array.isArray(timeline) && timeline.length >= minLength;
}

// Cache helper functions
function getCachedValue(key) {
  const cached = analyticsCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  analyticsCache.delete(key); // Clean up expired cache
  return null;
}

function setCachedValue(key, data) {
  analyticsCache.set(key, {
    timestamp: Date.now(),
    data,
  });
}

// Helper function to get channel username safely with input validation
function getChannelUsername() {
  if (!twitchClient?.channel) {
    throw new Error('Twitch client not properly initialized');
  }
  const username = twitchClient.channel.replace('#', '');
  return sanitizeInput(username);
}

// Helper function to safely get channel stats with improved error handling and caching
async function getChannelStats(username) {
  const cacheKey = `channelStats:${username}`;
  const cached = getCachedValue(cacheKey);
  if (cached) {
    logger.debug('Returning cached channel stats for:', username);
    return cached;
  }

  return deduplicateRequest(cacheKey, async () => {
    try {
      if (!twitchClient) {
        logger.error('TwitchClient not initialized in getChannelStats');
        return null;
      }

      if (!twitchClient.apiClient) {
        logger.error('TwitchClient API client not initialized in getChannelStats');
        return null;
      }

      logger.debug('Starting channel stats fetch for:', username);
      const channelStats = await twitchCircuitBreaker.execute(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

        try {
          // Apply rate limiting before API calls
          await rateLimit.acquire();
          logger.debug('Fetching user data for:', username);
          const user = await withRetry(() => twitchClient.apiClient.users.getUserByName(username));

          if (!user) {
            logger.error('User not found:', username);
            throw new Error('User not found');
          }

          logger.debug('User found:', { id: user.id, name: user.name });
          logger.debug('Fetching channel stats for user:', user.id);

          // Get stream, followers, and videos data using Twurple API
          logger.debug('Starting batch requests for user data');
          const [stream, followers, videos, channel] = await batchRequests([
            async () => {
              await rateLimit.acquire();
              logger.debug('Fetching stream data');
              const streamData = await twitchClient.apiClient.streams.getStreamByUserId(user.id);
              logger.debug('Stream data fetched:', { hasStream: !!streamData });
              return streamData;
            },
            async () => {
              await rateLimit.acquire();
              logger.debug('Fetching follower count');
              const followerCount = await twitchClient.apiClient.channels.getChannelFollowerCount(user.id);
              logger.debug('Follower count fetched:', { count: followerCount });
              return followerCount;
            },
            async () => {
              await rateLimit.acquire();
              logger.debug('Fetching videos');
              const videoData = await twitchClient.apiClient.videos.getVideosByUser(user.id, {
                type: 'archive',
                limit: 10,
              });
              logger.debug('Videos fetched:', { count: videoData?.data?.length });
              return videoData;
            },
            async () => {
              await rateLimit.acquire();
              logger.debug('Fetching channel info');
              const channelData = await twitchClient.apiClient.channels.getChannelInfoById(user.id);
              logger.debug('Channel info fetched');
              return channelData;
            },
          ]);

          logger.debug('All batch requests completed');

          // Calculate historical stats from videos with proper validation
          const recentStreams = videos?.data || [];
          const streamStats = recentStreams.reduce(
            (acc, video) => {
              const views = video.views || 0;
              const duration = video.duration || 0;
              if (views > 0) {
                acc.totalViews += views;
                acc.viewsList.push(views);
              }
              if (duration > 0) {
                acc.totalDuration += duration;
              }
              return acc;
            },
            { totalViews: 0, totalDuration: 0, viewsList: [] }
          );

          // Calculate average viewers from actual data, no default values
          const avgViewers = streamStats.viewsList.length > 0
            ? Math.round(streamStats.viewsList.reduce((a, b) => a + b, 0) / streamStats.viewsList.length)
            : (stream?.viewerCount || 0);

          const hoursStreamed = Math.round((streamStats.totalDuration / 3600) * 10) / 10;
          const daysStreamed = new Set(
            recentStreams
              .map((v) => v.creationDate?.toISOString().split('T')[0] || '')
              .filter(Boolean)
          ).size;

          const stats = {
            currentViewers: stream?.viewerCount || 0,
            followers: followers || 0,
            recentViewers: avgViewers,
            isLive: !!stream,
            streamStartTime: stream?.startDate || null,
            lastStreamDate: recentStreams[0]?.creationDate || null,
            gameId: stream?.gameId || channel?.gameId || null,
            historicalStats: {
              avgViewers,
              peakViewers: Math.max(stream?.viewerCount || 0, ...streamStats.viewsList.filter((v) => v > 0)) || 0,
              hoursStreamed,
              daysStreamed,
              recentGrowth: {
                trend: 'stable',
                viewers: 0,
              },
            },
          };

          // Calculate growth trend based on recent streams with proper null checks
          if (streamStats.viewsList.length >= 2) {
            const oldestViews = streamStats.viewsList[streamStats.viewsList.length - 1] || 0;
            const newestViews = streamStats.viewsList[0] || stream?.viewerCount || 0;
            const viewerTrend = oldestViews > 0 ? (newestViews - oldestViews) / oldestViews : 0;
            stats.historicalStats.recentGrowth = {
              viewers: viewerTrend,
              trend: calculateTrend(viewerTrend),
            };
          }

          logger.debug('Stats object created:', stats);
          return stats;
        } finally {
          clearTimeout(timeoutId);
        }
      });

      if (channelStats) {
        setCachedValue(cacheKey, channelStats);
        logger.debug('Channel stats cached for:', username);
      } else {
        logger.error('No stats returned from circuit breaker');
      }
      return channelStats;
    } catch (error) {
      logger.error('Error getting channel stats:', error);
      return null;
    }
  });
}

// Utility function to fetch TwitchTracker data with improved caching
async function fetchTwitchTrackerStats(username) {
  const cacheKey = `trackerStats:${username}`;
  const cached = getCachedValue(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Apply rate limiting before making the request
    await rateLimit.acquire();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    logger.debug('Fetching TwitchTracker stats for:', username);
    const response = await fetch(`https://twitchtracker.com/${username.toLowerCase()}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.error('TwitchTracker API error:', {
        status: response.status,
        statusText: response.statusText,
        username,
      });
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    if (!html) {
      logger.error('Empty response from TwitchTracker');
      throw new Error('Empty response from TwitchTracker');
    }
    logger.debug('Successfully fetched TwitchTracker HTML');
    const $ = cheerio.load(html);

    const stats = {
      avgViewers: parseFloat($('.to-number[data-format="0"]').first().text()) || 0,
      peakViewers: parseFloat($('.to-number[data-format="0"]').eq(1).text()) || 0,
      avgStreamTime: parseFloat($('.to-number[data-format="0.0"]').first().text()) || 0,
      hoursStreamed: parseFloat($('.to-number[data-format="0"]').eq(2).text()) || 0,
      followersGained: parseInt($('.to-number[data-format="0"]').eq(3).text()) || 0,
      daysStreamed: parseInt($('.to-number[data-format="0"]').eq(4).text()) || 0,
      maxFollowersGained: parseInt($('.to-number[data-format="0"]').eq(5).text()) || 0,
      schedule: [],
      recentGrowth: { trend: 'stable', viewers: 0 },
    };

    // Process historical data more efficiently
    const viewerHistory = [];
    $('.g-x').each((_, elem) => {
      const date = $(elem).find('.g-x-date').text();
      const viewers = parseFloat($(elem).find('.g-x-value').text()) || 0;
      if (date && viewers) {
        viewerHistory.push({ date, viewers });
      }
    });

    // Calculate growth trends
    if (viewerHistory.length > 1) {
      const recentViewers = viewerHistory.slice(-7);
      const viewerTrend =
        (recentViewers[recentViewers.length - 1].viewers - recentViewers[0].viewers) /
        recentViewers[0].viewers;
      const trend = calculateTrend(viewerTrend);
      stats.recentGrowth = {
        viewers: viewerTrend,
        trend,
      };
    }

    // Get stream schedule more efficiently
    $('.stream-schedule-item').each((_, elem) => {
      const day = $(elem).find('.day').text().trim();
      const time = $(elem).find('.time').text().trim();
      if (day && time) {
        stats.schedule.push({ day, time });
      }
    });

    setCachedValue(cacheKey, stats);
    return stats;
  } catch (error) {
    logger.error('Error fetching TwitchTracker stats:', error);
    return null;
  }
}

// Stream Analytics Commands
export const analyticsCommands = {
  '!peak': async () => {
    try {
      if (isOnCooldown('peak')) {
        return 'Command on cooldown. Please wait a few seconds.';
      }

      if (!twitchClient) {
        return 'Analytics not initialized. Please try again later.';
      }

      const channelStats = await getChannelStats(getChannelUsername(), true); // Bypass cache for live data
      if (!channelStats) {
        return 'Unable to fetch channel statistics.';
      }

      const performance = enhancedAnalytics.getStreamPerformance();
      const streamPerformanceData = Array.from(
        enhancedAnalytics.analyticsData.streamPerformance.values()
      );
      const localPeakViewers =
        streamPerformanceData.length > 0
          ? Math.max(...streamPerformanceData.map((data) => data.viewers || 0))
          : 0;

      // Use the higher of local tracking or current Twitch stats
      const peakViewers = Math.max(localPeakViewers, channelStats.currentViewers);
      const status = performance?.current?.status || 'unknown';

      return `Peak Viewers: ${peakViewers} | Current Viewers: ${channelStats.currentViewers} | Stream Status: ${status}`;
    } catch (error) {
      logger.error('Error getting peak viewers:', error);
      return 'Unable to get peak viewer data at this time.';
    }
  },

  '!growth': async () => {
    try {
        // Check cooldown and lock
        if (isOnCooldown('growth')) {
            logger.debug('Growth command on cooldown');
            return null;
        }

        // Try to acquire command lock
        if (!acquireCommandLock('growth')) {
            logger.debug('Growth command lock already acquired');
            return null;
        }

        if (!isAnalyticsInitialized()) {
            return 'Analytics not initialized. Please try again later.';
        }

        // Get current Twitch data first
        const channelStats = await getChannelStats(getChannelUsername());
        if (!channelStats) {
            return 'Unable to fetch channel statistics.';
        }

        // Get historical data
        const stats = analyticsData.getStats();
        if (!stats) {
            // If no historical data, use only current data
            const viewerGrowthRate = 0;
            const followersGrowth = channelStats.followers > 0
                ? ((channelStats.currentViewers / channelStats.followers) * 100).toFixed(2)
                : 0;

            return formatGrowthResponse({
                currentViewers: channelStats.currentViewers,
                avgViewers: channelStats.currentViewers,
                peakViewers: channelStats.currentViewers,
                viewerGrowthRate,
                followersGrowth,
                streamDays: 1,
                hoursStreamed: 0,
                consistency: 0,
            });
        }

        const { last30Days } = stats;
        const recentData = analyticsData.getRecentData(7);

        // Calculate metrics using both current and historical data
        const metrics = {
            currentViewers: channelStats.currentViewers || 0,
            avgViewers: last30Days.avgViewers || 0,
            peakViewers: Math.max(channelStats.currentViewers, last30Days.peakViewers),
            viewerGrowthRate: last30Days.avgViewers > 0
                ? ((channelStats.currentViewers - last30Days.avgViewers) / last30Days.avgViewers)
                : 0,
            followersGrowth: channelStats.followers > 0
                ? ((channelStats.currentViewers / channelStats.followers) * 100).toFixed(2)
                : 0,
            streamDays: recentData.filter(d => d.minutesStreamed > 0).length,
            hoursStreamed: Math.round(last30Days.totalStreamMinutes / 60),
            consistency: ((recentData.filter(d => d.minutesStreamed > 0).length / 7) * 100).toFixed(1),
        };

        // Clear any cached data to prevent stale information
        analyticsCache.delete('channelStats');

        return formatGrowthResponse(metrics);
    } catch (error) {
        logger.error('Error getting growth stats:', error);
        return 'Unable to get growth stats at this time.';
    }
  },

  '!trending': async () => {
    try {
      if (isOnCooldown('trending')) {
        return 'Command on cooldown. Please wait a few seconds.';
      }

      if (!twitchClient) {
        return 'Analytics not initialized. Please try again later.';
      }

      const channelStats = await getChannelStats(getChannelUsername());
      if (!channelStats) {
        return 'Unable to fetch channel statistics.';
      }

      // Get current category/game info
      const gameInfo = await twitchClient.apiClient.games.getGameById(channelStats.gameId);

      // Get top streams in the same category
      const categoryStreams = await twitchClient.apiClient.streams.getStreams({
        game: gameInfo?.name,
        limit: 20,
      });

      // Calculate category averages
      const categoryAvgViewers =
        categoryStreams.data.reduce((sum, stream) => sum + stream.viewers, 0) /
        categoryStreams.data.length;
      const categoryPosition =
        categoryStreams.data.findIndex(
          (stream) => stream.userId === twitchClient.configuration.userId
        ) + 1;

      // Get local content trends
      const localTrends = contentManager.getContentRecommendations() || { trending: [] };

      // Combine Twitch and local data
      const trendReport = [];

      if (gameInfo) {
        const viewerRatio = channelStats.currentViewers / categoryAvgViewers;
        let performanceEmoji = '📊';
        if (viewerRatio > 1) {
          performanceEmoji = '🔥';
        } else if (viewerRatio > 0.5) {
          performanceEmoji = '📈';
        }
        trendReport.push(`Category: ${gameInfo.name} ${performanceEmoji}`);

        if (categoryPosition > 0) {
          trendReport.push(`Category Rank: #${categoryPosition} of ${categoryStreams.data.length}`);
        }

        trendReport.push(`Category Avg Viewers: ${Math.round(categoryAvgViewers)}`);
      }

      // Add local trending content if available
      if (localTrends.trending && localTrends.trending.length > 0) {
        const topTrends = localTrends.trending
          .sort((a, b) => (b.engagement || 0) - (a.engagement || 0))
          .slice(0, 3)
          .map((t) => {
            let engagementLevel = '👍';
            if (t.engagement > 0.7) {
              engagementLevel = '🔥';
            } else if (t.engagement > 0.4) {
              engagementLevel = '📈';
            }
            return `${t.type} ${engagementLevel} (${Math.round((t.engagement || 0) * 100)}%)`;
          });
        trendReport.push('Top Content:', ...topTrends);
      }

      return trendReport.join('\n');
    } catch (error) {
      logger.error('Error getting trending segments:', error);
      return 'Unable to get trending segments at this time.';
    }
  },

  '!insights': async () => {
    try {
      if (isOnCooldown('insights')) {
        return 'Command on cooldown. Please wait a few seconds.';
      }

      if (!twitchClient) {
        return 'Analytics not initialized. Please try again later.';
      }

      const channelStats = await getChannelStats(getChannelUsername());
      if (!channelStats) {
        return 'Unable to fetch channel statistics.';
      }

      const performance = enhancedAnalytics.getStreamPerformance();
      const timeline = enhancedAnalytics.getEngagementTimeline('1h');

      if (!validateTimeline(timeline)) {
        return 'Not enough data to generate insights. Please try again later.';
      }

      const uniqueViewers = new Set(
        timeline.filter((e) => e.type === 'chat').map((e) => e.username)
      ).size;

      const engagement = performance?.current?.metrics?.engagement || 0;
      const status = performance?.current?.status || 'unknown';

      // Calculate stream uptime
      let uptimeStr = 'Stream offline';
      if (channelStats.streamStartTime) {
        const uptime = Math.floor(
          (Date.now() - channelStats.streamStartTime.getTime()) / 1000 / 60
        );
        const hours = Math.floor(uptime / 60);
        const minutes = uptime % 60;
        uptimeStr = `${hours}h ${minutes}m`;
      }

      // Calculate chat engagement rate
      const chatEngagementRate =
        uniqueViewers > 0 ? Math.round((uniqueViewers / channelStats.currentViewers) * 100) : 0;

      // Get stream health indicators
      let healthEmoji = '❌';
      if (status === 'healthy') {
        healthEmoji = '✅';
      } else if (status === 'moderate') {
        healthEmoji = '⚠️';
      }

      let engagementEmoji = '📊';
      if (engagement > 0.7) {
        engagementEmoji = '🔥';
      } else if (engagement > 0.4) {
        engagementEmoji = '👍';
      }

      // Compare current performance to historical averages
      const { historicalStats } = channelStats;
      const { avgViewers, recentGrowth } = historicalStats;
      const viewerComparisonPercent = getViewerComparisonPercent(
        channelStats.currentViewers,
        avgViewers
      );

      return `Stream Insights:
Uptime: ⏱️ ${uptimeStr}
Current Performance:
- Viewers: 👥 ${channelStats.currentViewers} (${viewerComparisonPercent} vs avg)
- Peak Today: 📊 ${Math.max(channelStats.currentViewers, historicalStats.peakViewers)}
- Followers: ❤️ ${channelStats.followers}
- Chat Activity: ${engagementEmoji} ${chatEngagementRate}% (${uniqueViewers} chatters)

Historical Stats:
- Avg Viewers: ${Math.round(avgViewers)}
- Peak Viewers: ${historicalStats.peakViewers}
- Hours Streamed: ${historicalStats.hoursStreamed}
- Stream Days: ${historicalStats.daysStreamed}

Stream Health: ${healthEmoji} ${status}`;
    } catch (error) {
      logger.error('Error getting retention insights:', error);
      return 'Unable to get viewer retention insights at this time.';
    }
  },

  '!recap': async () => {
    try {
      if (isOnCooldown('recap')) {
        return 'Command on cooldown. Please wait a few seconds.';
      }

      if (!twitchClient) {
        return 'Analytics not initialized. Please try again later.';
      }

      const channelStats = await getChannelStats(getChannelUsername());
      if (!channelStats) {
        return 'Unable to fetch channel statistics.';
      }

      // Get local summary
      const localSummary = await streamSummary.generateEndOfStreamSummary();

      // Calculate stream duration
      let duration = 'Stream offline';
      if (channelStats.streamStartTime) {
        const streamMinutes = Math.floor(
          (Date.now() - channelStats.streamStartTime.getTime()) / 1000 / 60
        );
        const hours = Math.floor(streamMinutes / 60);
        const minutes = streamMinutes % 60;
        duration = `${hours}h ${minutes}m`;
      }

      // Get clips created during this stream
      const clips = channelStats.streamStartTime
        ? await twitchClient.apiClient.clips.getClipsForBroadcaster(
            twitchClient.configuration.userId,
            {
              startDate: channelStats.streamStartTime,
              limit: 5,
            }
          )
        : { data: [] };

      // Format recap
      const recapLines = [
        `📊 Stream Recap (${duration})`,
        `Peak Viewers: ${channelStats.currentViewers}`,
        `New Followers: ${channelStats.newFollowers || 0}`,
        `Total Followers: ${channelStats.followers}`,
      ];

      if (clips.data.length > 0) {
        recapLines.push('\n🎬 Top Clips:');
        clips.data.forEach((clip) => {
          recapLines.push(`- ${clip.title} (${clip.views} views): ${clip.url}`);
        });
      }

      if (localSummary) {
        recapLines.push('\n📈 Performance Insights:', localSummary);
      }

      return recapLines.join('\n');
    } catch (error) {
      logger.error('Error generating recap:', error);
      return 'Unable to generate stream recap at this time.';
    }
  },

  '!highlight': async (description = '') => {
    try {
      if (isOnCooldown('highlight')) {
        return 'Command on cooldown. Please wait a few seconds.';
      }

      if (!twitchClient) {
        return 'Analytics not initialized. Please try again later.';
      }

      const timeline = enhancedAnalytics.getEngagementTimeline('5m');
      if (!validateTimeline(timeline, 5)) {
        return 'Not enough recent activity to analyze for highlights. Try again after more chat activity.';
      }

      const channelStats = await getChannelStats(getChannelUsername());
      if (!channelStats || !channelStats.isLive) {
        return 'Cannot create highlight while stream is offline.';
      }

      // Detect highlight moment
      const highlight = await contentManager.detectHighlight(timeline);
      if (!highlight || !highlight.triggers || !highlight.analysis) {
        const eventsCount = timeline.length;
        const chatCount = timeline.filter((e) => e.type === 'chat').length;
        return `No significant highlight detected. Current activity: ${chatCount} messages in last 5m (${eventsCount} total events). Keep engaging!`;
      }

      // Create clip if highlight is significant enough
      let clipUrl = null;
      if (highlight.analysis.intensity > 0.7) {
        try {
          const clip = await twitchClient.apiClient.clips.createClip({
            channel: getChannelUsername(),
            title: description || 'Stream Highlight',
          });
          clipUrl = clip.url;
        } catch (clipError) {
          logger.error('Error creating clip:', clipError);
        }
      }

      const intensity = Math.round((highlight.analysis.intensity || 0) * 100);
      let intensityEmoji = '📊';
      if (intensity > 75) {
        intensityEmoji = '🔥';
      } else if (intensity > 50) {
        intensityEmoji = '📈';
      }

      const response = [
        `Highlight Created! ${intensityEmoji}`,
        `Triggers: ${highlight.triggers.join(', ')}`,
        `Intensity: ${intensity}%`,
      ];

      if (clipUrl) {
        response.push(`Clip created: ${clipUrl}`);
      } else if (highlight.analysis.intensity > 0.7) {
        response.push('Clip creation failed - please try manually');
      }

      return response.join('\n');
    } catch (error) {
      logger.error('Error creating highlight:', error);
      return 'Unable to create highlight at this time.';
    }
  },

  '!vibe': async () => {
    try {
      if (isOnCooldown('vibe')) {
        return 'Command on cooldown. Please wait a few seconds.';
      }

      const timeline = enhancedAnalytics.getEngagementTimeline('5m');
      const chatMessages = timeline?.filter((e) => e.type === 'chat') || [];

      if (!validateTimeline(chatMessages, 3)) {
        // Require at least 3 chat messages
        return 'Not enough recent chat messages to analyze the vibe. Need at least 3 messages.';
      }

      const analysis = await Promise.all(
        chatMessages.map((e) =>
          aiService.analyzeMessage(e.data?.message || '', e.username || 'anonymous')
        )
      );

      const validAnalysis = analysis.filter((a) => a !== null && a !== undefined);
      if (validAnalysis.length === 0) {
        return 'Unable to analyze chat messages. Please try again in a moment.';
      }

      const avgSentiment =
        validAnalysis.reduce((sum, a) => sum + (a?.sentiment || 0), 0) / validAnalysis.length;

      let mood;
      let moodEmoji;
      if (avgSentiment > 0.3) {
        mood = 'Positive';
        moodEmoji = '😊';
      } else if (avgSentiment < -0.3) {
        mood = 'Negative';
        moodEmoji = '😟';
      } else {
        mood = 'Neutral';
        moodEmoji = '😐';
      }

      let energy;
      let energyEmoji;
      if (chatMessages.length > 10) {
        energy = 'High';
        energyEmoji = '⚡';
      } else if (chatMessages.length > 5) {
        energy = 'Medium';
        energyEmoji = '✨';
      } else {
        energy = 'Low';
        energyEmoji = '💫';
      }

      let activityStatus;
      if (chatMessages.length > 8) {
        activityStatus = 'Very Active!';
      } else if (chatMessages.length > 4) {
        activityStatus = 'Steady';
      } else {
        activityStatus = 'Quiet';
      }

      const uniqueChatters = new Set(chatMessages.map((m) => m.username)).size;
      return `Chat Vibe Analysis:
Mood: ${moodEmoji} ${mood}
Energy: ${energyEmoji} ${energy}
Messages: 💬 ${chatMessages.length} (${uniqueChatters} chatters)
Recent Activity: ${activityStatus}`;
    } catch (error) {
      logger.error('Error getting chat vibe:', error);
      return 'Unable to analyze chat vibe at this time.';
    }
  },

  '!schedule': async () => {
    try {
      if (isOnCooldown('schedule')) {
        return 'Command on cooldown. Please wait a few seconds.';
      }

      if (!twitchClient) {
        return 'Analytics not initialized. Please try again later.';
      }

      const channelStats = await getChannelStats(getChannelUsername());
      if (!channelStats) {
        return 'Unable to fetch channel statistics.';
      }

      const performance = enhancedAnalytics.getStreamPerformance();
      const timeline = enhancedAnalytics.getEngagementTimeline('24h');

      if (!validateTimeline(timeline, 10)) {
        return 'Not enough historical data to determine best streaming times. Keep streaming!';
      }

      // Get activity data from local timeline
      const hourlyActivity = new Map();
      let totalEvents = 0;
      let bestHours = [];

      timeline.forEach((event) => {
        const hour = new Date(event.timestamp).getHours();
        const currentCount = hourlyActivity.get(hour) || 0;
        hourlyActivity.set(hour, currentCount + 1);
        totalEvents++;
      });

      // Get historical schedule from TwitchTracker
      const trackerSchedule = channelStats.trackerStats?.schedule || [];
      const { historicalStats } = channelStats;
      const { avgViewers, recentGrowth } = historicalStats;

      // Format schedule information
      const scheduleLines = ['Stream Schedule Analysis:'];

      // Add consistency metrics
      const monthlyConsistency = ((historicalStats.daysStreamed / 30) * 100).toFixed(1);
      scheduleLines.push('\nStream Consistency:');
      scheduleLines.push(
        `- Days Streamed: ${historicalStats.daysStreamed}/30 (${monthlyConsistency}%)`
      );
      scheduleLines.push(
        `- Average Stream: ${Math.round(historicalStats.hoursStreamed / historicalStats.daysStreamed)}h per day`
      );

      // Add regular schedule if available
      if (trackerSchedule.length > 0) {
        scheduleLines.push('\nRegular Schedule:');
        trackerSchedule.forEach(({ day, time }) => scheduleLines.push(`- ${day}: ${time}`));
      }

      // Add best performing times based on local data
      if (totalEvents > 0) {
        const sortedHours = Array.from(hourlyActivity.entries()).sort(([, a], [, b]) => b - a);

        bestHours = sortedHours.slice(0, 3).map(([hour, count]) => {
          const percentage = Math.round((count / totalEvents) * 100);
          const timeStr = `${hour.toString().padStart(2, '0')}:00`;
          return `${timeStr} (${percentage}% activity)`;
        });

        scheduleLines.push('\nBest Performing Times:');
        bestHours.forEach((time, i) => scheduleLines.push(`${i + 1}. ${time}`));
      }

      // Add current stream status
      const status = performance?.current?.status || 'unknown';
      let statusEmoji;
      if (status === 'healthy') {
        statusEmoji = '✅';
      } else if (status === 'moderate') {
        statusEmoji = '⚠️';
      } else {
        statusEmoji = '❌';
      }

      scheduleLines.push(`\nCurrent Performance: ${statusEmoji} ${status}`);

      // Add recommendations based on data
      const recommendations = [];
      if (monthlyConsistency < 70) {
        recommendations.push('Consider streaming more regularly to build viewer habits');
      }
      if (avgViewers > channelStats.currentViewers) {
        recommendations.push(`Try streaming during peak times: ${bestHours[0]}`);
      }
      if (trackerSchedule.length === 0) {
        recommendations.push('Setting a regular schedule could help grow your audience');
      }

      if (recommendations.length > 0) {
        scheduleLines.push('\nRecommendations:');
        recommendations.forEach((rec) => scheduleLines.push(`- ${rec}`));
      }

      return scheduleLines.join('\n');
    } catch (error) {
      logger.error('Error getting schedule recommendations:', error);
      return 'Unable to get schedule recommendations at this time.';
    }
  },
};

// Helper function to get channel info using Twurple
export async function getChannelInfo(username = '') {
  try {
    if (!twitchClient?.apiClient) {
      throw new Error('Twitch API client not initialized');
    }

    const user = await twitchClient.apiClient.users.getUserByName(username);
    if (!user) {
      return null;
    }

    const channel = await twitchClient.apiClient.channels.getChannelInfoById(user.id);
    const stream = await twitchClient.apiClient.streams.getStreamByUserId(user.id);

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
    if (!twitchClient?.apiClient) {
      throw new Error('Twitch API client not initialized');
    }

    const stream = await twitchClient.apiClient.streams.getStreamByUserId(
      twitchClient.configuration.userId
    );
    return stream?.viewerCount || 0;
  } catch (error) {
    logger.error('Error getting viewer count:', error);
    return 0;
  }
}

// Helper functions with better performance
function getTrendFromViewers(current, average) {
  if (!Number.isFinite(current) || !Number.isFinite(average) || average <= 0) {
    return 'stable';
  }
  const ratio = current / average;
  if (ratio > 1.1) {
    return 'growing';
  }
  if (ratio < 0.7) {
    return 'declining';
  }
  return 'stable';
}

function getViewerComparisonPercent(current, average) {
  if (!Number.isFinite(current) || !Number.isFinite(average)) {
    return '+0%';
  }
  // If both values are 0, return 0% change
  if (current === 0 && average === 0) {
    return '+0%';
  }
  // If average is 0 but current is not, show as 100% increase
  if (average === 0) {
    return '+100%';
  }
  const percentChange = ((current - average) / average) * 100;
  // Cap the decrease at -100%
  if (percentChange < -100) {
    return '-100%';
  }
  const sign = percentChange > 0 ? '+' : '';
  return `${sign}${Math.round(percentChange)}%`;
}

// Calculate growth trends with simplified logic
function calculateTrend(viewerTrend) {
  if (viewerTrend > 0.1) {
    return 'growing';
  }
  if (viewerTrend < -0.1) {
    return 'declining';
  }
  return 'stable';
}

// Helper function to format growth response
function formatGrowthResponse(metrics) {
    // Determine trend
    let trend = 'stable';
    let confidence = 0.5;

    if (metrics.viewerGrowthRate > 0.1) {
        trend = 'growing';
        confidence = 0.8;
    } else if (metrics.viewerGrowthRate < -0.1) {
        trend = 'declining';
        confidence = 0.7;
    }

    // Select appropriate emojis
    let growthEmoji = '➡️';
    if (trend === 'growing') {
        growthEmoji = '📈';
    } else if (trend === 'declining') {
        growthEmoji = '📉';
    }

    // Get confidence emoji
    let confidenceEmoji = '❓';
    if (confidence > 0.7) {
        confidenceEmoji = '✅';
    } else if (confidence > 0.4) {
        confidenceEmoji = '⚠️';
    }

    // Format the response
    return `Growth Stats ${growthEmoji}
Trend: ${trend}

Current Stats:
  • Viewers: ${metrics.currentViewers} (Peak: ${metrics.peakViewers})
  • Avg Viewers: ${Math.round(metrics.avgViewers)}
  • Viewer/Follower Ratio: ${metrics.followersGrowth}%
  • Recent Growth: ${(metrics.viewerGrowthRate * 100).toFixed(1)}%

Stream History:
  • Hours Streamed: ${metrics.hoursStreamed}
  • Days Active: ${metrics.streamDays}
  • Consistency: ${metrics.consistency}%

Confidence: ${Math.round(confidence * 100)}% ${confidenceEmoji}`;
}

// Export everything as a single object
const analyticsModule = {
  ...analyticsCommands,
  initializeAnalytics,
  getChannelInfo,
  getCurrentViewerCount,
};

export default analyticsModule;
