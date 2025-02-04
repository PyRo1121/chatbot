import logger from '../utils/logger.js';

// Store analytics data in memory
const analyticsData = {
  chatActivity: new Map(), // username -> {messages, commands, bits, emotes, lastActive}
  highlights: [], // [{timestamp, type, data}]
  viewerStats: {
    totalMessages: 0,
    uniqueViewers: new Set(),
    firstTimeViewers: new Set(),
    returningViewers: new Set(),
  },
};

export async function trackChatActivity(user, message) {
  try {
    const messageStats = {
      timestamp: new Date(),
      username: user.username,
      messageType: message.startsWith('!') ? 'command' : 'chat',
      emotes: user.emotes ? Object.keys(user.emotes).length : 0,
      length: message.length,
      bits: user.bits || 0,
      subscriber: user.subscriber,
      mod: user.mod,
      firstMessage: user['first-msg'],
    };

    // Update user stats
    const userStats = analyticsData.chatActivity.get(user.username) || {
      messages: 0,
      commands: 0,
      bits: 0,
      emotes: 0,
      lastActive: null,
    };

    userStats.messages++;
    if (messageStats.messageType === 'command') {
      userStats.commands++;
    }
    userStats.bits += messageStats.bits;
    userStats.emotes += messageStats.emotes;
    userStats.lastActive = messageStats.timestamp;

    analyticsData.chatActivity.set(user.username, userStats);
    analyticsData.viewerStats.totalMessages++;

    // Track viewer status
    if (messageStats.firstMessage) {
      analyticsData.viewerStats.firstTimeViewers.add(user.username);
    } else {
      analyticsData.viewerStats.returningViewers.add(user.username);
    }
    analyticsData.viewerStats.uniqueViewers.add(user.username);

    // Check for highlights
    if (messageStats.bits > 100 || messageStats.firstMessage) {
      analyticsData.highlights.push({
        timestamp: messageStats.timestamp,
        type: messageStats.bits > 100 ? 'high_bits' : 'first_message',
        data: messageStats,
      });
    }

    logger.info('Chat activity tracked:', messageStats);
    return messageStats;
  } catch (error) {
    logger.error('Error tracking chat activity:', error);
    return null;
  }
}

export async function getViewerStats() {
  try {
    const stats = {
      totalMessages: analyticsData.viewerStats.totalMessages,
      uniqueViewers: analyticsData.viewerStats.uniqueViewers.size,
      firstTimeViewers: analyticsData.viewerStats.firstTimeViewers.size,
      returningViewers: analyticsData.viewerStats.returningViewers.size,
      activeViewers: Array.from(analyticsData.chatActivity.entries()).filter(
        ([_, stats]) => Date.now() - stats.lastActive < 30 * 60 * 1000
      ).length, // Active in last 30 minutes
    };

    return `Viewer Stats: Messages: ${stats.totalMessages} | Unique: ${stats.uniqueViewers} | New: ${stats.firstTimeViewers} | Returning: ${stats.returningViewers} | Active: ${stats.activeViewers}`;
  } catch (error) {
    logger.error('Error getting viewer stats:', error);
    return 'Failed to get viewer statistics';
  }
}

export async function getHighlights(hours = 24) {
  try {
    const recentHighlights = analyticsData.highlights
      .filter((h) => Date.now() - h.timestamp < hours * 60 * 60 * 1000)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5)
      .map((h) => {
        const time = h.timestamp.toLocaleTimeString();
        const user = h.data.username;
        const type = h.type === 'high_bits' ? `${h.data.bits} bits` : 'First message';
        return `${time} - ${user} (${type})`;
      })
      .join(' | ');

    return recentHighlights ? `Recent Highlights: ${recentHighlights}` : 'No recent highlights';
  } catch (error) {
    logger.error('Error getting highlights:', error);
    return 'Failed to get highlights';
  }
}

export async function trackViewer(username) {
  try {
    const now = new Date();
    const userStats = analyticsData.chatActivity.get(username) || {
      messages: 0,
      commands: 0,
      bits: 0,
      emotes: 0,
      lastActive: null,
    };

    userStats.lastActive = now;
    analyticsData.chatActivity.set(username, userStats);
    analyticsData.viewerStats.uniqueViewers.add(username);

    logger.info('Viewer tracked:', { username, stats: userStats });
    return null;
  } catch (error) {
    logger.error('Error tracking viewer:', error);
    return null;
  }
}

// Clean up old data periodically
export function cleanup() {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();

  // Remove highlights older than 7 days
  analyticsData.highlights = analyticsData.highlights.filter(
    (h) => now - h.timestamp < 7 * ONE_DAY
  );

  // Reset daily stats
  analyticsData.viewerStats.firstTimeViewers.clear();
  analyticsData.viewerStats.totalMessages = 0;

  logger.info('Analytics data cleaned up');
}

export default {
  trackChatActivity,
  getViewerStats,
  getHighlights,
  trackViewer,
  cleanup,
};
