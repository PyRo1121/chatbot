import moderationManager from '../moderationManager.js';

export const moderationCommands = {
  // Get moderation stats and recent actions
  modstats: async () => {
    // Wait for any pending moderation actions to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    const stats = moderationManager.getModerationStats();
    const recentWarnings = stats.warningsByUser
      .slice(0, 5)
      .map((user) => `${user.username} (${user.count} warnings)`);
    const recentActions = stats.recentActions
      .slice(0, 5)
      .map(
        (action) =>
          `${action.type} - ${action.username} (${new Date(action.timestamp).toLocaleTimeString()})`
      );

    return `📊 Moderation Statistics:
Spam Detected: ${stats.spamStats.detectedSpam}
False Positives: ${stats.spamStats.falsePositives}
Successful Raids: ${stats.spamStats.successfulRaids}
Blocked Raids: ${stats.spamStats.blockedRaids}
Trusted Users: ${stats.trustedUsers}

⚠️ Most Warned Users:
${recentWarnings.join('\n')}

🔨 Recent Actions:
${recentActions.join('\n')}

🔍 Active Patterns:
${stats.activePatterns.slice(0, 5).join('\n')}`;
  },

  // Get user moderation history
  userhistory: async (username) => {
    // Wait for user data to be loaded and processed
    await new Promise((resolve) => setTimeout(resolve, 100));
    const history = moderationManager.getUserHistory(username);
    const warnings = history.warnings
      .map((w) => `• ${new Date(w.timestamp).toLocaleString()}: ${w.reason}`)
      .join('\n');

    return `👤 User History for ${username}:
Messages: ${history.messageCount}
First Seen: ${new Date(history.firstSeen).toLocaleString()}
Trusted: ${history.isTrusted ? 'Yes' : 'No'}
Warnings: ${history.warnings.length}
${warnings ? `\nWarning History:\n${warnings}` : ''}`;
  },

  // Add a trusted user
  trust: async (username) => {
    // Wait for trust status to be updated
    await new Promise((resolve) => setTimeout(resolve, 100));
    moderationManager.addTrustedUser(username);
    return `✅ Added ${username} to trusted users list`;
  },

  // Remove a trusted user
  untrust: async (username) => {
    // Wait for trust status to be removed
    await new Promise((resolve) => setTimeout(resolve, 100));
    moderationManager.removeTrustedUser(username);
    return `❌ Removed ${username} from trusted users list`;
  },

  // View recent raids and their assessments
  raidhistory: async () => {
    // Wait for raid history to be loaded
    await new Promise((resolve) => setTimeout(resolve, 100));
    const raids = moderationManager.getRecentRaids();
    if (raids.length === 0) {
      return 'No recent raids recorded';
    }

    const raidList = raids.map((raid) => {
      const { assessment } = raid;
      const riskEmoji = {
        low: '🟢',
        medium: '🟡',
        high: '🔴',
      }[assessment.risk];

      return `${riskEmoji} ${raid.raider} (${raid.viewers} viewers) - ${assessment.action}
  Risk: ${assessment.risk}, Confidence: ${Math.round(assessment.confidence * 100)}%
  ${assessment.reason}`;
    });

    return `📊 Recent Raid Assessments:
${raidList.join('\n\n')}`;
  },

  // Analyze chat patterns for spam
  analyzechat: async () => {
    const analysis = await moderationManager.detectSpamPattern();
    if (!analysis || !analysis.hasPattern) {
      return 'No suspicious patterns detected in recent chat activity';
    }

    return `🔍 Chat Pattern Analysis:
Confidence: ${Math.round(analysis.confidence * 100)}%
Detected Patterns:
${analysis.patterns.map((p) => `• ${p}`).join('\n')}
Involved Users: ${analysis.involvedUsers.join(', ')}
Recommended Action: ${analysis.recommendedAction}`;
  },

  // Warn a user
  warn: async (username, reason) => {
    // Wait for warning to be processed
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (!reason) {
      return 'Please provide a reason for the warning';
    }

    const warningCount = moderationManager.warnUser(username, reason);
    return `⚠️ Warning issued to ${username} (Warning #${warningCount})
Reason: ${reason}`;
  },
};

// Function to analyze messages for moderation
export async function moderateMessage(message, username, userLevel) {
  const analysis = await moderationManager.analyzeMessage(message, username, userLevel);

  if (analysis.isSpam && analysis.confidence > moderationManager.SPAM_THRESHOLD) {
    return {
      action: analysis.action,
      reason: analysis.reason,
      duration: analysis.action === 'timeout' ? 600 : 0, // 10 minutes timeout by default
    };
  }

  return null;
}

// Function to assess raid quality
export async function assessRaid(raider, viewers) {
  const raidHistory = moderationManager.getRecentRaids();
  const assessment = await moderationManager.assessRaidQuality(raider, viewers, raidHistory);

  if (assessment.isSuspicious && assessment.confidence > moderationManager.RAID_QUALITY_THRESHOLD) {
    return {
      action: assessment.action,
      reason: assessment.reason,
      risk: assessment.risk,
    };
  }

  return null;
}
