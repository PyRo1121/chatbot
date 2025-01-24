import { ApiClient } from '@twurple/api';
import { RefreshingAuthProvider } from '@twurple/auth';
import tokenManager from '../auth/tokenManager.js';
import fs from 'fs/promises';
import path from 'path';
import { generateResponse } from '../utils/openai.js';
import chatInteraction from './chatInteraction.js';

const STREAM_DATA_FILE = path.join(process.cwd(), 'src/bot/stream_data.json');
let streamStartTime = null;
let milestones = [];

// Initialize stream data storage
async function initStreamData() {
  try {
    await fs.access(STREAM_DATA_FILE);
  } catch {
    await fs.writeFile(
      STREAM_DATA_FILE,
      JSON.stringify({
        milestones: [],
        categories: [],
        streamHistory: [],
        viewerEngagement: {},
        contentAnalytics: {
          successfulTitles: [],
          popularCategories: [],
          peakTimes: {},
          highlights: [],
        },
      })
    );
  }
}

// Analyze stream performance
async function analyzeStreamPerformance(streamData) {
  try {
    const prompt = `Analyze this stream data and provide insights. Focus on:
1. Viewer engagement patterns
2. Successful content types
3. Peak activity times
4. Notable moments

Data: ${JSON.stringify(streamData)}

Respond with JSON only:
{
  "recommendedTitle": "string (engaging title based on successful patterns)",
  "suggestedCategory": "string (category with highest engagement)",
  "bestStreamTime": "string (hour with highest viewer activity)",
  "contentSuggestions": ["array of content suggestions based on patterns"]
}`;

    const response = await generateResponse(prompt);
    return JSON.parse(response);
  } catch (error) {
    console.error('Error analyzing stream performance:', error);
    return null;
  }
}

// Track viewer engagement
async function trackEngagement(channel, viewerCount, chatActivity) {
  const streamData = await loadStreamData();
  const hour = new Date().getHours();

  if (!streamData.viewerEngagement[hour]) {
    streamData.viewerEngagement[hour] = {
      averageViewers: 0,
      chatActivity: 0,
      samples: 0,
    };
  }

  const current = streamData.viewerEngagement[hour];
  current.averageViewers =
    (current.averageViewers * current.samples + viewerCount) / (current.samples + 1);
  current.chatActivity =
    (current.chatActivity * current.samples + chatActivity) / (current.samples + 1);
  current.samples++;

  await saveStreamData(streamData);
}

// Auto-detect stream highlights
async function detectHighlight(message, viewerCount, chatActivity) {
  const streamData = await loadStreamData();
  const currentUptime = getStreamUptime();

  // Consider it a highlight if:
  // 1. High chat activity (2x normal)
  // 2. Increased viewer count (1.5x average)
  // 3. Positive chat sentiment
  const averageActivity =
    Object.values(streamData.viewerEngagement).reduce((sum, hour) => sum + hour.chatActivity, 0) /
      Object.keys(streamData.viewerEngagement).length || 1;

  const averageViewers =
    Object.values(streamData.viewerEngagement).reduce((sum, hour) => sum + hour.averageViewers, 0) /
      Object.keys(streamData.viewerEngagement).length || 1;

  if (chatActivity > averageActivity * 2 && viewerCount > averageViewers * 1.5) {
    const chatMood = chatInteraction.getMoodString();
    if (chatMood === 'Positive') {
      streamData.contentAnalytics.highlights.push({
        timestamp: new Date().toISOString(),
        uptime: currentUptime,
        message,
        viewerCount,
        chatActivity,
      });
      await saveStreamData(streamData);
      return true;
    }
  }
  return false;
}

// Get content recommendations
async function getStreamRecommendations() {
  const streamData = await loadStreamData();
  const analysis = await analyzeStreamPerformance(streamData);

  if (!analysis) {
    return null;
  }

  return {
    title: analysis.recommendedTitle,
    category: analysis.suggestedCategory,
    bestTime: analysis.bestStreamTime,
    suggestions: analysis.contentSuggestions,
  };
}

// Load stream data
async function loadStreamData() {
  try {
    const data = await fs.readFile(STREAM_DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading stream data:', error);
    return {
      milestones: [],
      categories: [],
      streamHistory: [],
      viewerEngagement: {},
      contentAnalytics: {
        successfulTitles: [],
        popularCategories: [],
        peakTimes: {},
        highlights: [],
      },
    };
  }
}

// Save stream data
async function saveStreamData(data) {
  try {
    await fs.writeFile(STREAM_DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving stream data:', error);
  }
}

// Update stream information
async function updateStreamInfo(channel, title, category) {
  try {
    const tokens = await tokenManager.getBroadcasterTokens();

    const authProvider = new RefreshingAuthProvider({
      clientId: tokens.clientId,
      clientSecret: tokens.clientSecret,
      onRefresh: async (userId, newTokenData) => {
        await tokenManager.updateBroadcasterTokens(newTokenData);
      },
    });

    await authProvider.addUserForToken({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: 0,
      obtainmentTimestamp: 0,
    });

    const apiClient = new ApiClient({ authProvider });

    await apiClient.channels.updateChannelInfo(channel.id, {
      title,
      gameId: category,
    });

    const streamData = await loadStreamData();
    streamData.categories.push({
      timestamp: new Date().toISOString(),
      title,
      category,
    });
    await saveStreamData(streamData);

    return true;
  } catch (error) {
    console.error('Error updating stream info:', error);
    return false;
  }
}

// Track stream uptime and milestones
function getStreamUptime() {
  if (!streamStartTime) {
    return 'Stream is offline';
  }
  const uptime = Date.now() - streamStartTime;
  const hours = Math.floor(uptime / (1000 * 60 * 60));
  const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

// Add stream milestone
async function addMilestone(milestone) {
  const streamData = await loadStreamData();
  streamData.milestones.push({
    timestamp: new Date().toISOString(),
    description: milestone,
    uptime: getStreamUptime(),
  });
  await saveStreamData(streamData);
}

// Stream commands
export { detectHighlight };

export const streamCommands = {
  recommendations: async () => {
    const recommendations = await getStreamRecommendations();
    if (!recommendations) {
      return 'Unable to generate recommendations at this time';
    }

    return `📊 Stream Recommendations:
    Title: ${recommendations.title}
    Category: ${recommendations.category}
    Best Time: ${recommendations.bestTime}
    Tips: ${recommendations.suggestions.join(', ')}`;
  },

  title: async (client, channel, user, message) => {
    if (!message.trim()) {
      return 'Please provide a new title for the stream';
    }
    const success = await updateStreamInfo(channel, message.trim(), null);
    return success ? 'Stream title updated!' : 'Failed to update stream title';
  },

  category: async (client, channel, user, message) => {
    if (!message.trim()) {
      return 'Please provide a category/game name';
    }
    const success = await updateStreamInfo(channel, null, message.trim());
    return success ? 'Stream category updated!' : 'Failed to update stream category';
  },

  uptime: () => getStreamUptime(),

  milestone: async (client, channel, user, message) => {
    if (!message.trim()) {
      return 'Please provide a milestone description';
    }
    await addMilestone(message.trim());
    return 'Milestone added!';
  },
};

// Stream event handlers
export const streamEventHandlers = {
  onStreamStart: () => {
    streamStartTime = Date.now();
    // Start engagement tracking
    setInterval(
      async () => {
        const chatStats = chatInteraction.getStats();
        const viewerCount = 0; // This should be fetched from Twitch API
        await trackEngagement('channel', viewerCount, chatStats.totalInteractions);
      },
      5 * 60 * 1000
    ); // Every 5 minutes
  },

  onStreamEnd: async () => {
    if (streamStartTime) {
      const streamData = await loadStreamData();
      const chatStats = chatInteraction.getStats();

      // Enhanced stream history
      streamData.streamHistory.push({
        startTime: new Date(streamStartTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: getStreamUptime(),
        milestones,
        analytics: {
          totalInteractions: chatStats.totalInteractions,
          topTopics: chatStats.topTopics,
          chatMood: chatStats.chatMood,
          highlights: streamData.contentAnalytics.highlights,
        },
      });

      // Update successful patterns
      const currentTitle = streamData.categories[streamData.categories.length - 1]?.title;
      const currentCategory = streamData.categories[streamData.categories.length - 1]?.category;

      if (currentTitle && chatStats.totalInteractions > 0) {
        streamData.contentAnalytics.successfulTitles.push({
          title: currentTitle,
          engagement: chatStats.totalInteractions,
          mood: chatStats.chatMood.current.sentiment,
        });
      }

      if (currentCategory) {
        streamData.contentAnalytics.popularCategories.push({
          category: currentCategory,
          engagement: chatStats.totalInteractions,
          duration: getStreamUptime(),
        });
      }
      await saveStreamData(streamData);
      streamStartTime = null;
      milestones = [];
    }
  },
};

// Initialize stream data on module load
initStreamData();
