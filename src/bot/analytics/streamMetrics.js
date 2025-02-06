import { generateResponse } from '../../utils/deepseek.js';
import logger from '../../utils/logger.js';

let twitchClient;

export function initializeMetrics(client) {
  twitchClient = client;
}

// Store stream metrics
const streamData = {
  peakViewers: {
    count: 0,
    timestamp: null,
  },
  segments: [],
  chatActivity: [],
  raids: [],
  clips: [],
};

// Update peak viewers
export async function updatePeakViewers() {
  const stream = await twitchClient.twitchApi.streams.getStreamByUserId(
    twitchClient.configuration.userId
  );
  if (!stream) {
    return;
  }

  const currentViewers = stream.viewerCount;
  const now = new Date();
  if (currentViewers > streamData.peakViewers.count) {
    streamData.peakViewers = {
      count: currentViewers,
      timestamp: now,
    };
  }

  // Add to segments for trending analysis
  streamData.segments.push({
    timestamp: now,
    viewers: currentViewers,
    type: 'viewers',
  });
}

// Add chat activity
export function addChatActivity(username, message, type = 'message') {
  streamData.chatActivity.push({
    username,
    message,
    type,
    timestamp: new Date(),
  });
}

// Add raid
export function addRaid(raider, viewers) {
  streamData.raids.push({
    username: raider,
    viewers,
    timestamp: new Date(),
  });
}

// Add clip
export function addClip(clipId, creator, title) {
  streamData.clips.push({
    id: clipId,
    creator,
    title,
    timestamp: new Date(),
  });
}

// Get peak viewers command
export async function getPeakViewers() {
  if (!streamData.peakViewers.timestamp) {
    return 'No peak viewer data available for this stream yet.';
  }

  const timeStr = streamData.peakViewers.timestamp.toLocaleTimeString();
  return `Peak viewers: ${streamData.peakViewers.count} (reached at ${timeStr})`;
}

// Get growth stats command
export async function getGrowthStats() {
  try {
    const channel = await twitchClient.twitchApi.channels.getChannelInfo(
      twitchClient.configuration.userId
    );
    const followers = await twitchClient.twitchApi.channels.getChannelFollowers(
      twitchClient.configuration.userId
    );
    const subscriptions = await twitchClient.twitchApi.subscriptions.getSubscriptions(
      twitchClient.configuration.userId
    );

    const stats = {
      followers: {
        count: followers.total,
        recentFollowers: followers.data.length,
      },
      subscribers: {
        count: subscriptions.total,
        points: channel.channelPoints,
      },
    };

    // Generate AI insights about the growth
    const prompt = `Generate a brief, encouraging analysis of these stream growth stats: ${JSON.stringify(stats)}. Focus on positive trends and growth opportunities.`;
    const systemPrompt =
      'You are a helpful streaming analytics assistant. Keep responses concise and actionable.';

    const insight = await generateResponse(prompt, systemPrompt);

    return (
      'Growth Stats:\n' +
      `Followers: ${stats.followers.count} (${stats.followers.recentFollowers} new)\n` +
      `Subscribers: ${stats.subscribers.count}\n` +
      `Channel Points: ${stats.subscribers.points}\n` +
      `${insight || ''}`
    );
  } catch (error) {
    logger.error('Error getting growth stats:', error);
    return 'Unable to get growth stats at this time.';
  }
}

// Get trending segments
export async function getTrendingSegments() {
  if (streamData.segments.length === 0) {
    return 'No segment data available for this stream yet.';
  }

  // Find segments with highest viewer counts
  const sortedSegments = [...streamData.segments].sort((a, b) => b.viewers - a.viewers).slice(0, 3);

  // Generate AI analysis of the trending segments
  const prompt = `Analyze these top performing stream segments and suggest why they might have been successful: ${JSON.stringify(sortedSegments)}`;
  const systemPrompt =
    'You are a helpful streaming analytics assistant. Provide brief, actionable insights.';

  const analysis = await generateResponse(prompt, systemPrompt);

  return analysis || 'Unable to analyze trending segments at this time.';
}

// Get viewer retention insights
export async function getRetentionInsights() {
  // Calculate retention metrics
  const { segments } = streamData;
  if (segments.length < 2) {
    return 'Not enough data to analyze viewer retention yet.';
  }

  const retentionData = {
    averageViewers: segments.reduce((sum, seg) => sum + seg.viewers, 0) / segments.length,
    viewerTrend: segments[segments.length - 1].viewers - segments[0].viewers,
    peakRetention: Math.max(...segments.map((s) => s.viewers)),
    totalSegments: segments.length,
  };

  // Generate AI insights about retention
  const prompt = `Analyze these viewer retention metrics and provide actionable insights: ${JSON.stringify(retentionData)}`;
  const systemPrompt =
    'You are a helpful streaming analytics assistant. Focus on practical tips for improving viewer retention.';

  const insights = await generateResponse(prompt, systemPrompt);

  return insights || 'Unable to generate retention insights at this time.';
}

// Reset stream data
export function resetStreamData() {
  streamData.peakViewers = { count: 0, timestamp: null };
  streamData.segments = [];
  streamData.chatActivity = [];
  streamData.raids = [];
  streamData.clips = [];
}

// Export all functions
export default {
  initializeMetrics,
  updatePeakViewers,
  addChatActivity,
  addRaid,
  addClip,
  getPeakViewers,
  getGrowthStats,
  getTrendingSegments,
  getRetentionInsights,
  resetStreamData,
};
