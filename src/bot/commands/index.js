import { handlePing } from './ping.js';
import { handleRoast } from './roast.js';
import {
  handleListQueue,
  handleClearQueue,
  handleRemoveFromQueue,
  handleSongRequest,
} from './queue.js';
import { handleAddCommand, handleRemoveCommand } from './customCommands.js';
import {
  handleStartTrivia,
  handleStartWordChain,
  handleStartMiniGame,
  handleAnswer,
} from './games.js';
import { handleStreamInsights } from './streamInsights.js';
import { detectHighlight, streamEventHandlers } from '../streamManager.js';
import analyticsCommands from './analyticsCommands.js';
import streamHandlers from './streamHandlers.js';
import logger from '../../utils/logger.js';

// Export all stream-related handlers
export const {
  handleChatActivity,
  handleClip,
  handleHighlights,
  handleTitle,
  handleCategory,
  handleUptime,
  handleMilestone,
  handleSuspiciousFollowers,
  handleClearSuspicious,
  handleFollowSettings,
  handleRecommendations,
  handleViewerStats,
  handleLoyalty,
  handleTopViewers,
  handleRaids,
  handleRaid,
  trackViewer,
  handleHealth,
  handleStreamPerformance,
  handleBestTimes,
  handleTopCategories,
  initializeAnalytics,
  endAnalytics,
  handleCreateClip,
  handleClipsByCategory,
  handleClipsByTag,
  handleRecentClips,
  handleTopClips,
  handleClipStats,
  handleSuggestCompilation,
  handleAnalyzeClip,
  handleModStats,
  handleUserHistory,
  handleTrust,
  handleUntrust,
  handleRaidHistory,
  handleAnalyzeChat,
  handleWarn,
  moderateMessage,
  assessRaid,
  competitorCommands,
  handleShoutout,
  startTrivia,
  handleTriviaAnswer,
  endTrivia,
} = streamHandlers;

const commands = {
  // Existing commands
  '!roast': async (twitchClient, channel, targetUser) => {
    const result = await handleRoast(twitchClient, channel, targetUser);
    return result;
  },

  // Analytics Commands
  '!peak': async () => analyticsCommands['!peak'](),
  '!growth': async () => analyticsCommands['!growth'](),
  '!trending': async () => analyticsCommands['!trending'](),
  '!insights': async () => analyticsCommands['!insights'](),

  // Engagement Commands
  '!recap': async () => analyticsCommands['!recap'](),
  '!highlight': async (description) => analyticsCommands['!highlight'](description),
  '!vibe': async () => analyticsCommands['!vibe'](),

  // Content Optimization Commands
  '!category': async () => analyticsCommands['!category'](),
  '!title': async (description) => analyticsCommands['!title'](description),
  '!schedule': async () => analyticsCommands['!schedule'](),
  '!tags': async () => analyticsCommands['!tags'](),

  // Community Commands
  '!shoutout': async (username) => analyticsCommands['!shoutout'](username),
  '!raid': async () => analyticsCommands['!raid'](),
  '!collab': async () => analyticsCommands['!collab'](),
  '!network': async () => analyticsCommands['!network'](),

  // Help command to list available commands
  '!help': async () => {
    return `Available commands:
    Stream Analytics: !peak, !growth, !trending, !insights
    Engagement: !recap, !highlight, !vibe
    Content: !category, !title, !schedule, !tags
    Community: !shoutout, !raid, !collab, !network
    Fun: !roast @username`;
  },
};

// Create command list for help message
export const commandList = Object.keys(commands).join(', ');

// Process command
export async function processCommand(twitchClient, channel, tags, message) {
  try {
    const args = message.trim().split(' ');
    const command = args[0].toLowerCase();
    const commandHandler = commands[command];

    if (commandHandler) {
      // Extract target user for commands that need it
      const targetUser = args[1] ? args[1].replace('@', '') : null;
      // Get description for commands that need it
      const description = args.slice(1).join(' ');

      // Execute command
      const response = await commandHandler(twitchClient, channel, targetUser, description);

      if (response) {
        if (typeof response === 'object' && response.message) {
          return response.message;
        }
        return response;
      }
    }
    return null;
  } catch (error) {
    logger.error('Error processing command:', error);
    return 'An error occurred while processing the command.';
  }
}

// Export all required handlers
export {
  handlePing,
  handleRoast,
  handleListQueue,
  handleClearQueue,
  handleRemoveFromQueue,
  handleSongRequest,
  handleAddCommand,
  handleRemoveCommand,
  handleStartTrivia,
  handleStartWordChain,
  handleStartMiniGame,
  handleAnswer as handleGameAnswer,
  handleStreamInsights,
  detectHighlight,
  streamEventHandlers,
};

export default {
  processCommand,
  commands,
  commandList,
};
