<<<<<<< HEAD
import { handleRoast } from './roast.js';
import { handlePing } from './ping.js';
import { handleShoutout } from './shoutout.js';
import { startTrivia, handleTriviaAnswer, endTrivia } from './trivia.js';
import { handleStreamInsights } from './streamInsights.js';
import { viewerCommands, handleRaid, trackViewer } from './viewer.js';
import { analyticsCommands, initializeAnalytics, endAnalytics } from './analytics.js';
import { clipManagementCommands } from './clipManagement.js';
import { moderationCommands, moderateMessage, assessRaid } from './moderation.js';
import {
  handleListQueue,
  handleClearQueue,
  handleRemoveFromQueue,
  handleSongRequest,
  processSongQueue,
  songQueue,
} from './queue.js';
import { clipCommands, handleChatActivity } from './clips.js';
import { streamCommands, streamEventHandlers } from '../streamManager.js';
import { followProtectionCommands } from './followProtection.js';
import setupCompetitorCommands from './competitor.js';

// Export existing commands
export {
  handleRoast,
  handlePing,
  handleShoutout,
  startTrivia,
  handleTriviaAnswer,
  endTrivia,
  handleListQueue,
  handleClearQueue,
  handleRemoveFromQueue,
  handleSongRequest,
  processSongQueue,
  songQueue,
  handleStreamInsights,
  handleChatActivity,
  streamEventHandlers,
};

// Export new clip commands
export const handleClip = clipCommands.clip;
export const handleHighlights = clipCommands.highlights;

// Export moderation commands
export const handleModStats = moderationCommands.modstats;
export const handleUserHistory = moderationCommands.userhistory;
export const handleTrust = moderationCommands.trust;
export const handleUntrust = moderationCommands.untrust;
export const handleRaidHistory = moderationCommands.raidhistory;
export const handleAnalyzeChat = moderationCommands.analyzechat;
export const handleWarn = moderationCommands.warn;
export { moderateMessage, assessRaid };

// Export clip management commands
export const handleCreateClip = clipManagementCommands.createclip;
export const handleClipsByCategory = clipManagementCommands.clipsbycategory;
export const handleClipsByTag = clipManagementCommands.clipsbytag;
export const handleRecentClips = clipManagementCommands.recentclips;
export const handleTopClips = clipManagementCommands.topclips;
export const handleClipStats = clipManagementCommands.clipstats;
export const handleSuggestCompilation = clipManagementCommands.suggestcompilation;
export const handleAnalyzeClip = clipManagementCommands.analyzeclip;

// Export analytics commands
export const handleHealth = analyticsCommands.health;
export const handleStreamPerformance = analyticsCommands.performance;
export const handleBestTimes = analyticsCommands.besttimes;
export const handleTopCategories = analyticsCommands.topcategories;
export { initializeAnalytics, endAnalytics };

// Export viewer commands
export const handleViewerStats = viewerCommands.stats;
export const handleLoyalty = viewerCommands.loyalty;
export const handleTopViewers = viewerCommands.topviewers;
export const handleRaids = viewerCommands.raids;
export { handleRaid, trackViewer };

// Export stream commands
export const handleTitle = streamCommands.title;
export const handleCategory = streamCommands.category;
export const handleUptime = streamCommands.uptime;
export const handleMilestone = streamCommands.milestone;
export const handleRecommendations = streamCommands.recommendations;

// Export follow protection commands
export const handleSuspiciousFollowers = followProtectionCommands.suspicious;
export const handleClearSuspicious = followProtectionCommands.clear;
export const handleFollowSettings = followProtectionCommands.settings;

// Export competitor commands
export const competitorCommands = setupCompetitorCommands;

export const commandList =
  '!ping, !songrequest, !queue, !queueclear, !queueremove, !roast, !trivia, !wordchain, !minigame [scramble|riddle], !insights (broadcaster only), !clip [title], !highlights [days], !title [new title], !category [game], !uptime, !milestone [description], !recommendations, !chatinsights, !followprotection (mods only), !suspicious (broadcaster only), !clearsuspicious (broadcaster only), !followsettings (broadcaster only), !viewerstats, !loyalty, !topviewers, !raids, !health, !performance, !besttimes, !topcategories, !createclip [title], !clipsbycategory [category], !clipsbytag [tag], !recentclips [days], !topclips, !clipstats, !suggestcompilation, !analyzeclip [clipId], !modstats (mods only), !userhistory [username] (mods only), !trust [username] (mods only), !untrust [username] (mods only), !raidhistory (mods only), !analyzechat (mods only), !warn [username] [reason] (mods only), !track [channel] (broadcaster only), !untrack [channel] (broadcaster only), !insights (broadcaster only), !suggestions (broadcaster only), !tracked (broadcaster only), !shoutout [username], !trivia';
=======
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
>>>>>>> origin/master
