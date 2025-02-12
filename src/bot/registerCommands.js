import commandRegistry from './commandRegistry.js';
import {
  handlePing,
  handleLurk,
  handleRoast,
  handleChatActivity,
  handleChatInsights,
  handleAnalyzeClip,
  handleClip,
  handleCreateClip,
  handleClipsByTag,
  handleRecentClips,
  handleHighlights,
  handleClipStats,
  handleSuggestCompilation,
  handleTitle,
  handleCategory,
  handleUptime,
  handleMilestone,
  handleSuspiciousFollowers,
  handleClearSuspicious,
  handleFollowSettings,
  handleFollowStats,
  handleFollowCheck,
  handleFollowMode,
  handleRecommendations,
  handleViewerStats,
  handleLoyalty,
  handleTopViewers,
  handleRaids,
  handleHealth,
  handleBestTimes,
  handleTopCategories,
  handleModStats,
  handleUserHistory,
  handleTrust,
  handleUntrust,
  handleRaidHistory,
  handleAnalyzeChat,
  handleWarn,
  competitorCommands,
  handleShoutout,
  startTrivia,
  handleTriviaAnswer,
  endTrivia,
  handleSongRequest,
  handleListQueue,
  handleClearQueue,
  handleRemoveFromQueue,
  handleAddCommand,
  handleRemoveCommand,
  handleListCommands,
  handleUserCommands,
  handleModCommands,
  handleStartWordChain,
  handleStartMiniGame,
  handleAnswer,
  viewerCommands,
  handleStreamHealth,
  handleStreamStats,
  handleStreamPerformance,
} from './commands/index.js';

import analyticsCommandsModule from './commands/analyticsCommands.js';
import streamCommands from './streamManager.js';

function registerCommands() {
  // Basic commands - Low cooldown, high rate limit
  commandRegistry.register('!ping', {
    handler: handlePing,
    description: 'Check if the bot is responsive',
    cooldown: 5000,
    rateLimit: { count: 3, window: 60000 },
  });

  commandRegistry.register('!lurk', {
    handler: handleLurk,
    description: "Let everyone know you're lurking",
    cooldown: 300000, // 5 minutes
  });

  // Moderator commands - No rate limits for mods
  commandRegistry.register('!warn', {
    handler: handleWarn,
    permissions: ['mod', 'broadcaster'],
    description: 'Warn a user',
    usage: '!warn [username] [reason]',
  });

  // Analytics commands - Higher cooldowns due to processing
  commandRegistry.register('!stats', {
    handler: handleViewerStats,
    description: 'View stream statistics',
    cooldown: 30000,
    rateLimit: { count: 5, window: 300000 },
  });

  commandRegistry.register('!analytics', {
    handler: analyticsCommandsModule.handleAnalytics,
    permissions: ['broadcaster'],
    description: 'View detailed analytics',
    cooldown: 60000,
  });

  // Stream management commands
  commandRegistry.register('!title', {
    handler: handleTitle,
    permissions: ['mod', 'broadcaster'],
    description: 'Change stream title',
    usage: '!title [new title]',
    cooldown: 5000,
  });

  commandRegistry.register('!category', {
    handler: handleCategory,
    permissions: ['mod', 'broadcaster'],
    description: 'Change stream category',
    usage: '!category [new category]',
    cooldown: 5000,
  });

  // Music commands
  commandRegistry.register('!songrequest', {
    handler: handleSongRequest,
    description: 'Request a song',
    usage: '!songrequest [song name]',
    cooldown: 30000,
    rateLimit: { count: 3, window: 300000 },
  });

  commandRegistry.register('!queue', {
    handler: handleListQueue,
    description: 'View the current song queue',
    cooldown: 10000,
  });

  commandRegistry.register('!clearqueue', {
    handler: handleClearQueue,
    permissions: ['mod', 'broadcaster'],
    description: 'Clear the song queue',
  });

  commandRegistry.register('!queueremove', {
    handler: handleRemoveFromQueue,
    description: 'Remove your song from the queue',
    usage: '!queueremove [position]',
    cooldown: 5000,
  });

  // Game commands
  commandRegistry.register('!trivia', {
    handler: startTrivia,
    permissions: ['mod', 'broadcaster'],
    description: 'Start a trivia game',
    cooldown: 300000, // 5 minutes between games
  });

  commandRegistry.register('!answer', {
    handler: handleTriviaAnswer,
    description: 'Answer the current trivia question',
    cooldown: 2000, // Short cooldown between answers
  });

  commandRegistry.register('!endtrivia', {
    handler: endTrivia,
    permissions: ['mod', 'broadcaster'],
    description: 'End the current trivia game',
  });

  // Clip commands
  commandRegistry.register('!clip', {
    handler: handleClip,
    description: 'Create a clip of the current stream',
    cooldown: 30000,
    rateLimit: { count: 5, window: 600000 },
  });

  commandRegistry.register('!highlights', {
    handler: handleHighlights,
    description: 'View stream highlights',
    cooldown: 30000,
  });

  commandRegistry.register('!analyzeclip', {
    handler: handleAnalyzeClip,
    permissions: ['mod', 'broadcaster'],
    description: 'Analyze a clip',
    usage: '!analyzeclip [clip URL]',
    cooldown: 60000,
  });

  // Competitor analysis commands
  commandRegistry.register('!track', {
    handler: competitorCommands.handleTrack,
    permissions: ['broadcaster'],
    description: 'Track a competitor channel',
    usage: '!track [channel name]',
    cooldown: 60000,
  });

  commandRegistry.register('!untrack', {
    handler: competitorCommands.handleUntrack,
    permissions: ['broadcaster'],
    description: 'Stop tracking a competitor',
    usage: '!untrack [channel name]',
  });

  commandRegistry.register('!insights', {
    handler: competitorCommands.handleInsights,
    permissions: ['broadcaster'],
    description: 'View competitor insights',
    cooldown: 300000,
  });

  // Chat analysis commands
  commandRegistry.register('!chatinsights', {
    handler: handleChatInsights,
    description: 'View chat insights',
    cooldown: 60000,
    rateLimit: { count: 3, window: 300000 },
  });

  commandRegistry.register('!analyzechat', {
    handler: handleAnalyzeChat,
    permissions: ['mod', 'broadcaster'],
    description: 'Analyze chat patterns',
    cooldown: 300000,
  });

  // Viewer management commands
  commandRegistry.register('!trust', {
    handler: handleTrust,
    permissions: ['mod', 'broadcaster'],
    description: 'Trust a viewer',
    usage: '!trust [username]',
  });

  commandRegistry.register('!untrust', {
    handler: handleUntrust,
    permissions: ['mod', 'broadcaster'],
    description: 'Untrust a viewer',
    usage: '!untrust [username]',
  });

  // Stream health commands
  commandRegistry.register('!health', {
    handler: handleHealth,
    description: 'Check stream health',
    cooldown: 30000,
  });

  commandRegistry.register('!streamhealth', {
    handler: handleStreamHealth,
    description: 'View detailed stream health stats',
    cooldown: 60000,
  });

  // Performance commands
  commandRegistry.register('!performance', {
    handler: handleStreamPerformance,
    permissions: ['mod', 'broadcaster'],
    description: 'View stream performance metrics',
    cooldown: 60000,
  });

  // Follower management commands
  commandRegistry.register('!followstats', {
    handler: handleFollowStats,
    description: 'View follower statistics',
    cooldown: 30000,
  });

  commandRegistry.register('!followcheck', {
    handler: handleFollowCheck,
    permissions: ['mod', 'broadcaster'],
    description: "Check a user's follow status",
    usage: '!followcheck [username]',
    cooldown: 5000,
  });

  // Custom commands management
  commandRegistry.register('!addcom', {
    handler: handleAddCommand,
    permissions: ['mod', 'broadcaster'],
    description: 'Add a custom command',
    usage: '!addcom [command] [response]',
  });

  commandRegistry.register('!delcom', {
    handler: handleRemoveCommand,
    permissions: ['mod', 'broadcaster'],
    description: 'Remove a custom command',
    usage: '!delcom [command]',
  });

  commandRegistry.register('!commands', {
    handler: handleUserCommands,
    description: 'List available commands',
    cooldown: 10000,
  });

  // Mini-games
  commandRegistry.register('!wordchain', {
    handler: handleStartWordChain,
    permissions: ['mod', 'broadcaster'],
    description: 'Start a word chain game',
    cooldown: 300000,
  });

  commandRegistry.register('!minigame', {
    handler: handleStartMiniGame,
    permissions: ['mod', 'broadcaster'],
    description: 'Start a mini-game',
    cooldown: 300000,
  });

  // Shoutout command
  commandRegistry.register('!shoutout', {
    handler: handleShoutout,
    permissions: ['mod', 'broadcaster'],
    description: 'Give a shoutout to another streamer',
    usage: '!shoutout [username]',
    cooldown: 5000,
    rateLimit: { count: 5, window: 300000 },
  });

  // Analytics module commands
  [
    '!peak',
    '!growth',
    '!trending',
    '!recap',
    '!vibe',
    '!schedule',
    '!tags',
    '!collab',
    '!network',
  ].forEach((cmd) => {
    const permissions = ['broadcaster'];
    if (cmd === '!peak' || cmd === '!recap' || cmd === '!vibe') {
      permissions.push('mod');
    }

    commandRegistry.register(cmd, {
      handler: analyticsCommandsModule[cmd],
      permissions,
      description: `Analytics: ${cmd.slice(1)}`,
      cooldown: 60000,
    });
  });
}

export default registerCommands;
