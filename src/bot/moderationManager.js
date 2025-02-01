import logger from '../utils/logger.js';

// Store moderation data in memory
const moderationData = {
  warnings: new Map(), // username -> [{timestamp, reason}]
  trustedUsers: new Set(),
  raidHistory: [], // [{username, viewers, timestamp, suspicious}]
  chatStats: new Map(), // username -> {messages, timeouts, bans, lastActive}
};

export async function getModStats() {
  try {
    const stats = {
      totalWarnings: Array.from(moderationData.warnings.values()).flat().length,
      trustedUsers: moderationData.trustedUsers.size,
      recentRaids: moderationData.raidHistory.slice(-7).length,
      suspiciousRaids: moderationData.raidHistory.filter((r) => r.suspicious)
        .length,
    };

    return `Moderation Stats: Warnings: ${stats.totalWarnings} | Trusted Users: ${stats.trustedUsers} | Recent Raids: ${stats.recentRaids} | Suspicious Raids: ${stats.suspiciousRaids}`;
  } catch (error) {
    logger.error('Error getting mod stats:', error);
    return 'Failed to get moderation statistics';
  }
}

export async function getUserHistory(targetUser) {
  try {
    const userStats = moderationData.chatStats.get(
      targetUser.toLowerCase()
    ) || {
      messages: 0,
      timeouts: 0,
      bans: 0,
      lastActive: null,
    };

    const warnings =
      moderationData.warnings.get(targetUser.toLowerCase()) || [];
    const isTrusted = moderationData.trustedUsers.has(targetUser.toLowerCase());

    return `User History for ${targetUser}: Messages: ${userStats.messages} | Timeouts: ${userStats.timeouts} | Bans: ${userStats.bans} | Warnings: ${warnings.length} | Trusted: ${isTrusted} | Last Active: ${userStats.lastActive ? new Date(userStats.lastActive).toLocaleString() : 'Never'}`;
  } catch (error) {
    logger.error('Error getting user history:', error);
    return 'Failed to get user history';
  }
}

export async function trustUser(targetUser) {
  try {
    moderationData.trustedUsers.add(targetUser.toLowerCase());
    logger.info(`User trusted: ${targetUser}`);
    return `${targetUser} has been added to trusted users`;
  } catch (error) {
    logger.error('Error trusting user:', error);
    return 'Failed to trust user';
  }
}

export async function untrustUser(targetUser) {
  try {
    const removed = moderationData.trustedUsers.delete(
      targetUser.toLowerCase()
    );
    logger.info(`User untrusted: ${targetUser}`);
    return removed
      ? `${targetUser} has been removed from trusted users`
      : `${targetUser} was not a trusted user`;
  } catch (error) {
    logger.error('Error untrusting user:', error);
    return 'Failed to untrust user';
  }
}

export async function getRaidHistory() {
  try {
    const recentRaids = moderationData.raidHistory
      .slice(-5)
      .map(
        (raid) =>
          `${raid.username} (${raid.viewers} viewers)${raid.suspicious ? ' ⚠️' : ''}`
      )
      .join(' | ');

    return recentRaids ? `Recent raids: ${recentRaids}` : 'No recent raids';
  } catch (error) {
    logger.error('Error getting raid history:', error);
    return 'Failed to get raid history';
  }
}

export async function analyzeChat() {
  try {
    const stats = {
      activeUsers: moderationData.chatStats.size,
      totalMessages: Array.from(moderationData.chatStats.values()).reduce(
        (sum, user) => sum + user.messages,
        0
      ),
      moderationActions: Array.from(moderationData.chatStats.values()).reduce(
        (sum, user) => sum + user.timeouts + user.bans,
        0
      ),
    };

    return `Chat Analysis: Active Users: ${stats.activeUsers} | Total Messages: ${stats.totalMessages} | Moderation Actions: ${stats.moderationActions}`;
  } catch (error) {
    logger.error('Error analyzing chat:', error);
    return 'Failed to analyze chat';
  }
}

export async function warnUser(targetUser, reason) {
  try {
    const warnings =
      moderationData.warnings.get(targetUser.toLowerCase()) || [];
    warnings.push({
      timestamp: Date.now(),
      reason: reason || 'No reason provided',
    });
    moderationData.warnings.set(targetUser.toLowerCase(), warnings);

    logger.info(`User warned: ${targetUser}`, { reason });
    return `${targetUser} has been warned. Total warnings: ${warnings.length}`;
  } catch (error) {
    logger.error('Error warning user:', error);
    return 'Failed to warn user';
  }
}

export function moderateMessage(message, username, userLevel) {
  try {
    // Update user stats
    const userStats = moderationData.chatStats.get(username.toLowerCase()) || {
      messages: 0,
      timeouts: 0,
      bans: 0,
      lastActive: null,
    };

    userStats.messages++;
    userStats.lastActive = Date.now();
    moderationData.chatStats.set(username.toLowerCase(), userStats);

    // Basic moderation checks
    const isTrusted = moderationData.trustedUsers.has(username.toLowerCase());
    const warnings = moderationData.warnings.get(username.toLowerCase()) || [];

    // Return if trusted or mod
    if (isTrusted || userLevel === 'mod') {
      return null;
    }

    // Check for suspicious behavior
    const suspicious = {
      excessiveCaps:
        message.replace(/[^A-Z]/g, '').length > message.length * 0.7,
      spamCharacters: /(.)\1{9,}/.test(message), // 10+ repeated characters
      urlSpam: (message.match(/https?:\/\//g) || []).length > 2,
    };

    if (Object.values(suspicious).some(Boolean)) {
      return {
        action: warnings.length >= 3 ? 'timeout' : 'warning',
        duration: 300, // 5 minute timeout
        reason: Object.entries(suspicious)
          .filter(([_, value]) => value)
          .map(([key]) => key)
          .join(', '),
      };
    }

    return null;
  } catch (error) {
    logger.error('Error moderating message:', error);
    return null;
  }
}

// Track raid for history
export function trackRaid(username, viewers, suspicious = false) {
  moderationData.raidHistory.push({
    username,
    viewers,
    timestamp: Date.now(),
    suspicious,
  });

  // Keep only last 100 raids
  if (moderationData.raidHistory.length > 100) {
    moderationData.raidHistory.shift();
  }
}

export default {
  getModStats,
  getUserHistory,
  trustUser,
  untrustUser,
  getRaidHistory,
  analyzeChat,
  warnUser,
  moderateMessage,
  trackRaid,
};
