import chatInteraction from '../chatInteraction.js';
import enhancedAnalytics from '../enhancedAnalytics.js';
import contentManager from '../contentManager.js';
import streamSummary from '../streamSummary.js';
import logger from '../../utils/logger.js';

export async function handleMood(channel, user, args) {
  try {
    return await chatInteraction.chatCommands['!mood']();
  } catch (error) {
    logger.error('Error handling mood command:', error);
    return 'Error getting chat mood';
  }
}

export async function handleEngagement(channel, user, args) {
  try {
    return await chatInteraction.chatCommands['!engagement'](user.username);
  } catch (error) {
    logger.error('Error handling engagement command:', error);
    return 'Error getting engagement stats';
  }
}

export async function handleChatStats(channel, user, args) {
  try {
    return await chatInteraction.chatCommands['!chatstats'](user.username);
  } catch (error) {
    logger.error('Error handling chatstats command:', error);
    return 'Error getting chat stats';
  }
}

export async function handlePoints(channel, user, args) {
  try {
    return await chatInteraction.chatCommands['!points'](user.username);
  } catch (error) {
    logger.error('Error handling points command:', error);
    return 'Error getting points';
  }
}

export async function handleLastActive(channel, user, args) {
  try {
    return await chatInteraction.chatCommands['!lastactive'](user.username);
  } catch (error) {
    logger.error('Error handling lastactive command:', error);
    return 'Error getting last active time';
  }
}

export async function handleStreamSummary(channel, user, args) {
  try {
    if (user.isBroadcaster || user.isMod) {
      const summary = await streamSummary.generateEndOfStreamSummary();
      return summary;
    }
    return 'This command is for moderators only';
  } catch (error) {
    logger.error('Error handling stream summary command:', error);
    return 'Error generating stream summary';
  }
}

export async function handleContentInsights(channel, user, args) {
  try {
    if (user.isBroadcaster || user.isMod) {
      const insights = contentManager.getContentRecommendations();
      return `Content Insights:
Top Categories: ${insights.categories.map(([cat, data]) => `${cat} (${Math.round(data.trending ? data.confidence * 100 : 0)}% trending)`).join(', ')}
Recent Highlights: ${insights.highlights.map((h) => h.triggers.join(', ')).join(' | ')}
Trending: ${insights.trending.map((t) => t.type).join(', ')}`;
    }
    return 'This command is for moderators only';
  } catch (error) {
    logger.error('Error handling content insights command:', error);
    return 'Error getting content insights';
  }
}

export async function handleStreamPerformance(channel, user, args) {
  try {
    if (user.isBroadcaster || user.isMod) {
      const performance = enhancedAnalytics.getStreamPerformance();
      return `Stream Performance:
Status: ${performance.current.status}
Growth: ${performance.predictions.growth?.trend || 'stable'} (${Math.round((performance.predictions.growth?.rate || 0) * 100)}%)
Engagement: ${Math.round(performance.current.metrics.engagement * 100)}%
Chat Activity: ${performance.current.metrics.chatActivity} messages/min
Recommendations: ${performance.recommendations.map((r) => r.suggestion).join(' | ')}`;
    }
    return 'This command is for moderators only';
  } catch (error) {
    logger.error('Error handling stream performance command:', error);
    return 'Error getting stream performance';
  }
}

// New commands to add to the system
export const enhancedCommandList = [
  '!mood - Check current chat mood',
  '!engagement - View your engagement metrics',
  '!chatstats - See your detailed chat statistics',
  '!points - Check your interaction points',
  '!lastactive - See when you were last active',
  '!streamsummary - Generate stream summary (mods only)',
  '!contentinsights - View content performance insights (mods only)',
  '!performance - Check detailed stream performance (mods only)',
];

// Command handlers map
export const enhancedCommands = {
  '!mood': handleMood,
  '!engagement': handleEngagement,
  '!chatstats': handleChatStats,
  '!points': handlePoints,
  '!lastactive': handleLastActive,
  '!streamsummary': handleStreamSummary,
  '!contentinsights': handleContentInsights,
  '!performance': handleStreamPerformance,
};
