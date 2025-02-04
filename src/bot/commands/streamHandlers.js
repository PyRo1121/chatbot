import fs from 'fs/promises';
import path from 'path';

import logger from '../../utils/logger.js';
import { generateResponse } from '../../utils/gemini.js';
import enhancedAnalytics from '../enhancedAnalytics.js';
import spotifyAuth from '../../auth/spotifyAuth.js';
import chatInteraction from '../chatInteraction.js';
import streamSummary from '../streamSummary.js';
import welcomeManager from '../welcomeManager.js';

export async function handleChatActivity(client, channel, user, message) {
  try {
    await enhancedAnalytics.trackEngagement({
      type: 'chat',
      username: user.username,
      data: { message },
    });
    return null; // No response needed for chat activity tracking
  } catch (error) {
    logger.error('Error handling chat activity:', error);
    return null;
  }
}

export async function handleStreamStart(client, channel, user) {
  try {
    await chatInteraction.startStream();
    welcomeManager.clearStreamMemory(); // Clear greetings memory at stream start
    const prompt = `Create an exciting stream start announcement. Include:
    - Warm welcome to viewers
    - Encourage chat interaction
    - Keep it enthusiastic but concise (max 200 characters)`;

    const announcement = await generateResponse(prompt);
    return announcement || 'Stream starting! Welcome everyone! 🎮';
  } catch (error) {
    logger.error('Error handling stream start:', error);
    return 'Stream starting! Welcome everyone! 🎮';
  }
}

export async function handleStreamEnd(client, channel, user) {
  try {
    const summary = await streamSummary.generateEndOfStreamSummary();
    await chatInteraction.endStream();
    welcomeManager.clearStreamMemory(); // Clear greetings memory at stream end
    return summary;
  } catch (error) {
    logger.error('Error handling stream end:', error);
    return 'Stream ending! Thanks for watching! 👋';
  }
}

export async function handleViewerUpdate(client, channel, viewerCount) {
  try {
    await enhancedAnalytics.trackEngagement({
      type: 'viewers',
      data: { count: viewerCount },
    });
    return null; // No response needed for viewer updates
  } catch (error) {
    logger.error('Error handling viewer update:', error);
    return null;
  }
}

export async function handleRaidReceived(client, channel, raider, viewers) {
  try {
    await enhancedAnalytics.trackEngagement({
      type: 'raid',
      username: raider,
      data: { viewers },
    });

    const prompt = `Create a warm welcome message for a raid from ${raider} with ${viewers} viewers.
    Make it enthusiastic and welcoming. Keep it under 200 characters.`;

    const message = await generateResponse(prompt);
    return (
      message ||
      `Welcome raiders from ${raider}'s channel! Thanks for the raid with ${viewers} viewers! 🎉`
    );
  } catch (error) {
    logger.error('Error handling raid:', error);
    return `Welcome raiders from ${raider}'s channel! Thanks for the raid! 🎉`;
  }
}

export async function handleMilestone(client, channel, user, description) {
  try {
    await enhancedAnalytics.trackEngagement({
      type: 'milestone',
      data: {
        description,
        timestamp: Date.now(),
      },
    });

    const prompt = `Create an exciting milestone announcement for: ${description}
    Make it engaging and celebratory. Keep it under 200 characters.`;

    const message = await generateResponse(prompt);
    return message || `We just hit a milestone: ${description}! 🎉`;
  } catch (error) {
    logger.error('Error handling milestone:', error);
    return `We just hit a milestone: ${description}! 🎉`;
  }
}

export async function handleStreamHealth(client, channel, user) {
  try {
    const performance = enhancedAnalytics.getStreamPerformance();
    const health = performance.current;

    return `Stream Health: Status: ${health.status} | Engagement: ${Math.round(
      health.metrics.engagement * 100
    )}% | Chat Activity: ${health.metrics.chatActivity}/min | Viewers: ${Math.round(
      health.metrics.averageViewers
    )} avg`;
  } catch (error) {
    logger.error('Error handling stream health:', error);
    return 'Unable to get stream health at this time.';
  }
}

export async function handleStreamPerformance(client, channel, user) {
  try {
    const performance = enhancedAnalytics.getStreamPerformance();
    const { predictions } = performance;

    return `Stream Performance: Growth: ${
      predictions.growth?.trend || 'stable'
    } (${Math.round((predictions.growth?.rate || 0) * 100)}%) | Engagement: ${Math.round(
      performance.current.metrics.engagement * 100
    )}% | Recommendations: ${performance.recommendations[0]?.suggestion || 'None'}`;
  } catch (error) {
    logger.error('Error handling stream performance:', error);
    return 'Unable to get stream performance at this time.';
  }
}

export async function handleStreamStats(client, channel, user) {
  try {
    const timeline = enhancedAnalytics.getEngagementTimeline('1h');
    const chatMessages = timeline.filter((event) => event.type === 'chat').length;
    const uniqueChatters = new Set(
      timeline.filter((event) => event.type === 'chat').map((event) => event.username)
    ).size;
    const viewers = timeline
      .filter((event) => event.type === 'viewers')
      .map((event) => event.data.count);
    const avgViewers =
      viewers.length > 0 ? Math.round(viewers.reduce((a, b) => a + b, 0) / viewers.length) : 0;

    return `Stream Stats: Messages: ${chatMessages} | Unique Chatters: ${uniqueChatters} | Average Viewers: ${avgViewers} | Timeline Events: ${timeline.length}`;
  } catch (error) {
    logger.error('Error handling stream stats:', error);
    return 'Unable to get stream stats at this time.';
  }
}

export async function handleSongRequest(client, channel, user, song) {
  try {
    // Import spotify manager
    const spotify = (await import('../../spotify/spotify.js')).default;

    // Use the spotify manager to handle the request
    // Handle both string username and user object
    const username = typeof user === 'string' ? user : user.username;
    const result = await spotify.handleSongRequest(song, username);
    if (typeof result === 'object' && result.message) {
      return result.message;
    }
    return result;
  } catch (error) {
    logger.error('Error handling song request:', error);
    return 'Sorry, there was an error processing your song request.';
  }
}

export async function handlePlaylist(client, channel, user) {
  // Handle both string username and user object
  const username = typeof user === 'string' ? user : user.username;
  try {
    // Import spotify manager
    const spotify = (await import('../../spotify/spotify.js')).default;

    // Use the spotify manager to get queue status
    const result = await spotify.getQueueStatus();
    if (typeof result === 'object' && result.message) {
      return result.message;
    }
    return result;
  } catch (error) {
    logger.error('Error handling playlist:', error);
    return 'Unable to retrieve the playlist at this time.';
  }
}
