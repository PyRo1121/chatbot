import { handleRoast } from './roast.js';
import { handlePing } from './ping.js';
import { handleStreamInsights } from './streamInsights.js';
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

// Export new stream commands
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
  '!ping, !songrequest, !queue, !queueclear, !queueremove, !roast, !trivia, !wordchain, !minigame [scramble|riddle], !insights (broadcaster only), !clip [title], !highlights [days], !title [new title], !category [game], !uptime, !milestone [description], !recommendations, !chatinsights, !followprotection (mods only), !suspicious (broadcaster only), !clearsuspicious (broadcaster only), !followsettings (broadcaster only)';
