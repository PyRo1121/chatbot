import advancedModeration from '../advancedModeration.js';
import logger from '../../utils/logger.js';
import { generateResponse } from '../../utils/gemini.js';

export async function handleModStats(client, channel, user) {
  try {
    const stats = await advancedModeration.getStats();
    return `Moderation Stats: Timeouts: ${stats.timeouts} | Bans: ${stats.bans} | Warnings: ${stats.warnings} | Messages Deleted: ${stats.deletedMessages}`;
  } catch (error) {
    logger.error('Error getting mod stats:', error);
    return 'Error retrieving moderation stats. Please try again later.';
  }
}

export async function handleUserHistory(client, channel, user, args) {
  try {
    if (!args || args.length === 0) {
      return 'Please specify a username!';
    }

    const targetUser = args[0].replace('@', '');
    const history = await advancedModeration.getUserHistory(targetUser);

    if (!history) {
      return `No moderation history found for ${targetUser}`;
    }

    return `${targetUser}'s History: Timeouts: ${history.timeouts} | Warnings: ${history.warnings} | Last Action: ${history.lastAction}`;
  } catch (error) {
    logger.error('Error getting user history:', error);
    return 'Error retrieving user history. Please try again later.';
  }
}

export async function handleTrust(client, channel, user, args) {
  try {
    if (!args || args.length === 0) {
      return 'Please specify a username!';
    }

    const targetUser = args[0].replace('@', '');
    await advancedModeration.trustUser(targetUser);
    return `${targetUser} has been added to trusted users!`;
  } catch (error) {
    logger.error('Error trusting user:', error);
    return 'Error updating trusted users. Please try again later.';
  }
}

export async function handleUntrust(client, channel, user, args) {
  try {
    if (!args || args.length === 0) {
      return 'Please specify a username!';
    }

    const targetUser = args[0].replace('@', '');
    await advancedModeration.untrustUser(targetUser);
    return `${targetUser} has been removed from trusted users!`;
  } catch (error) {
    logger.error('Error untrusting user:', error);
    return 'Error updating trusted users. Please try again later.';
  }
}

export async function handleRaidHistory(client, channel, user) {
  try {
    const history = await advancedModeration.getRaidHistory();
    if (!Array.isArray(history) || history.length === 0) {
      return 'No raid history available!';
    }

    const recentRaids = history
      .slice(-3)
      .map((raid) => `${raid.username}(${raid.viewers})`)
      .join(', ');
    return `Recent Raids: ${recentRaids} | Total Raids: ${history.length}`;
  } catch (error) {
    logger.error('Error getting raid history:', error);
    return 'Error retrieving raid history. Please try again later.';
  }
}

export async function handleAnalyzeChat(client, channel, user) {
  try {
    const analysis = await advancedModeration.getChatAnalysis();
    const prompt = `Analyze this chat data:
    Messages per minute: ${analysis?.messagesPerMinute || 0}
    Unique chatters: ${analysis?.uniqueChatters || 0}
    Emote usage: ${analysis?.emoteUsage || 0}%
    Spam detected: ${analysis?.spamDetected || 0}
    
    Provide a brief analysis of chat health and moderation needs.
    Keep it concise, max 200 characters.`;

    const insight = await generateResponse(prompt);
    return insight || 'Unable to generate chat analysis at this time.';
  } catch (error) {
    logger.error('Error analyzing chat:', error);
    return 'Error analyzing chat. Please try again later.';
  }
}

export async function handleWarn(client, channel, user, args) {
  try {
    if (!args || args.length < 2) {
      return 'Please specify a username and reason!';
    }

    const targetUser = args[0].replace('@', '');
    const reason = args.slice(1).join(' ');

    await advancedModeration.warnUser(targetUser, reason);
    return `Warning issued to ${targetUser}: ${reason}`;
  } catch (error) {
    logger.error('Error warning user:', error);
    return 'Error issuing warning. Please try again later.';
  }
}

export async function moderateMessage(message, user) {
  try {
    const result = await advancedModeration.analyzeMessage(message, user);
    if (!result) {
      return null;
    }

    if (result.action === 'timeout') {
      return {
        action: 'timeout',
        duration: result.duration,
        reason: result.reason,
      };
    }

    if (result.action === 'ban') {
      return {
        action: 'ban',
        reason: result.reason,
      };
    }

    if (result.action === 'delete') {
      return {
        action: 'delete',
        reason: result.reason,
      };
    }

    if (result.action === 'warning') {
      return {
        action: 'warning',
        message: result.reason,
      };
    }

    return null;
  } catch (error) {
    logger.error('Error moderating message:', error);
    return null;
  }
}
