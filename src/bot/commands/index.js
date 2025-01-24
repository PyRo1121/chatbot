import { handleRoast } from './roast.js';
import { handlePing } from './ping.js';
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

// Export existing commands
export {
  handleRoast,
  handlePing,
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

export const commandList =
  '!ping, !songrequest, !queue, !queueclear, !queueremove, !roast, !trivia, !wordchain, !minigame [scramble|riddle], !insights (broadcaster only), !clip [title], !highlights [days], !title [new title], !category [game], !uptime, !milestone [description], !recommendations, !chatinsights, !followprotection (mods only), !suspicious (broadcaster only), !clearsuspicious (broadcaster only), !followsettings (broadcaster only), !viewerstats, !loyalty, !topviewers, !raids, !health, !performance, !besttimes, !topcategories, !createclip [title], !clipsbycategory [category], !clipsbytag [tag], !recentclips [days], !topclips, !clipstats, !suggestcompilation, !analyzeclip [clipId], !modstats (mods only), !userhistory [username] (mods only), !trust [username] (mods only), !untrust [username] (mods only), !raidhistory (mods only), !analyzechat (mods only), !warn [username] [reason] (mods only)';
