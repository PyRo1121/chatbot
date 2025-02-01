import logger from '../../utils/logger.js';
import streamManager from '../streamManager.js';
import { generateResponse } from '../../utils/perplexity.js';

export async function handleChatActivity(client, channel, user, message) {
  try {
    streamManager.trackChatActivity();
    return null; // No response needed for chat activity tracking
  } catch (error) {
    logger.error('Error handling chat activity:', error);
    return null;
  }
}

export async function handleStreamStart(client, channel, user) {
  try {
    streamManager.startStream();
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
    const endMessage = await streamManager.generateStreamEndMessage();
    streamManager.endStream();
    return endMessage;
  } catch (error) {
    logger.error('Error handling stream end:', error);
    return 'Stream ending! Thanks for watching! 👋';
  }
}

export async function handleViewerUpdate(client, channel, viewerCount) {
  try {
    streamManager.updateViewers(viewerCount);
    return null; // No response needed for viewer updates
  } catch (error) {
    logger.error('Error handling viewer update:', error);
    return null;
  }
}

export async function handleRaidReceived(client, channel, raider, viewers) {
  try {
    streamManager.trackRaid({ username: raider, viewers });
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
    streamManager.addHighlight({
      type: 'milestone',
      description,
      timestamp: new Date().toISOString(),
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
    const health = await streamManager.getStreamHealth();
    return `Stream Health: Status: ${health.status} | Score: ${health.score}/100 | Bitrate: ${health.bitrate.average}kbps (${health.bitrate.stability})`;
  } catch (error) {
    logger.error('Error handling stream health:', error);
    return 'Unable to get stream health at this time.';
  }
}

export async function handleStreamPerformance(client, channel, user) {
  try {
    const performance = await streamManager.getStreamPerformance();
    return `Stream Performance: Viewer Retention: ${performance.viewerRetention}% | Engagement: ${performance.averageEngagement}% | Best Category: ${performance.bestCategory}`;
  } catch (error) {
    logger.error('Error handling stream performance:', error);
    return 'Unable to get stream performance at this time.';
  }
}

export async function handleStreamStats(client, channel, user) {
  try {
    const stats = streamManager.getStreamStats();
    const { currentStream } = stats;
    return `Stream Stats: Duration: ${currentStream.duration.toFixed(2)}h | Viewers: ${
      Math.round(
        currentStream.viewers.reduce((a, b) => a + b, 0) /
          currentStream.viewers.length
      ) || 0
    } avg | Chat: ${currentStream.chatActivity} | Highlights: ${currentStream.highlights.length}`;
  } catch (error) {
    logger.error('Error handling stream stats:', error);
    return 'Unable to get stream stats at this time.';
  }
}
