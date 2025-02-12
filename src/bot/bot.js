import getClient from './twitchClient.js';
import analytics, { initializeAnalytics, endAnalytics } from './analytics.js';
import chatInteraction from './chatInteraction.js';
import competitorAnalysis from './competitorAnalysis.js';
import { trackViewer } from './viewerManager.js';
import streamAutomation from './streamAutomation.js';
import spotify from '../spotify/spotify.js';
import logger from '../utils/logger.js';
import unifiedModerationManager from './unifiedModerationManager.js';
import analyticsCommands from './commands/analyticsCommands.js';
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
  moderateMessage,
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
  handleHug,
} from './commands/index.js';
import streamManager, {
  detectHighlight,
  streamCommands,
  streamEventHandlers,
} from './streamManager.js';

const recentMessages = new Map();
const MESSAGE_CACHE_TIME = 5000; // 5 seconds

async function handleMessage(twitchClient, channel, user, message, self) {
  if (!twitchClient?.client) {
    logger.error('No valid Twitch client provided to handleMessage');
    return;
  }

  if (!user?.username || typeof user.username !== 'string') {
    logger.error('No valid user object provided to handleMessage:', { user });
    return;
  }

  // Create a unique key for this message
  const messageKey = `${user.username}:${message}:${Date.now()}`;
  
  // Check if we've seen this message recently
  if (recentMessages.has(messageKey)) {
    logger.debug('Duplicate message detected, skipping');
    return;
  }

  // Add message to recent messages
  recentMessages.set(messageKey, true);
  
  // Clean up old messages after delay
  setTimeout(() => {
    recentMessages.delete(messageKey);
  }, MESSAGE_CACHE_TIME);

  logger.debug('Processing message:', {
    channel,
    username: user.username,
    displayName: user.displayName,
    isMod: user.isMod,
    isBroadcaster: user.isBroadcaster,
    badges: user.badges,
  });

  if (self) {
    logger.debug('Ignoring self message');
    return;
  }

  if (!message) {
    logger.debug('Empty message received');
    return;
  }

  try {
    // Check message with unified moderation system first
    const moderationResult = await unifiedModerationManager.moderateMessage(message, user.username, user);
    if (moderationResult) {
      logger.info('Message moderated:', {
        username: user.username,
        action: moderationResult.action,
        reason: moderationResult.reason,
      });

      // Apply moderation action
      switch (moderationResult.action) {
        case 'warning':
          await twitchClient.client.say(channel, `@${user.username}, warning: ${moderationResult.reason}`);
          break;
        case 'timeout':
          await twitchClient.client.timeout(channel, user.username, moderationResult.duration, moderationResult.reason);
          break;
        case 'ban':
          await twitchClient.client.ban(channel, user.username, moderationResult.reason);
          break;
      }
      return;
    }

    // Handle commands first
    if (message.startsWith('!')) {
      logger.debug('Command detected:', { message });
      try {
        await handleCommand(twitchClient, channel, user, message);
      } catch (error) {
        logger.error('Error in handleCommand:', error);
      }
      return;
    }

    // Check for game answers in regular chat
    try {
      const gameResponse = handleAnswer(user.username, message);
      if (gameResponse) {
        await twitchClient.client.say(channel, gameResponse.message);
        return;
      }
    } catch (error) {
      logger.error('Error handling game answer:', error);
    }

    // Handle regular chat messages
    try {
      // Check for potential highlight moments
      const currentViewers = streamManager.getStreamStats().currentStream.viewers;
      const viewerCount = currentViewers.length > 0 ? currentViewers[currentViewers.length - 1] : 0;
      const isHighlight = await detectHighlight(
        message,
        viewerCount,
        chatInteraction.getTotalInteractions()
      );
      if (isHighlight) {
        streamManager.addHighlight({
          type: 'chat',
          message,
          username: user.username,
          description: `Chat highlight from ${user.username}: ${message}`,
        });
        logger.info('Chat highlight detected:', {
          message,
          username: user.username,
        });
      }

      const engagementResponse = await chatInteraction.handleChatMessage(user.username, message);
      const engagementResponse = await chatInteraction.handleChatMessage(user.username, message);
      if (engagementResponse) {
        await twitchClient.client.say(channel, engagementResponse);
      }
    } catch (error) {
      logger.error('Error in chat engagement:', error);
    }

    // Track viewer activity and handle welcome messages
    try {
      // Track viewer but don't send welcome messages
      const milestone = trackViewer(user.username);


      // Only send milestone messages, skip automatic greetings
      if (milestone) {
        await twitchClient.client.say(channel, milestone);
      }


      // Removed engagement prompts
    } catch (error) {
      logger.error('Error tracking viewer:', error);
    }

    // Handle chat activity
    try {
      await handleChatActivity(twitchClient.client, channel, user, message);
    } catch (error) {
      logger.error('Error handling chat activity:', error);
    }
  } catch (error) {
    logger.error('Error handling message:', error);
  }
}

async function initBot() {
  logger.startupMessage('Starting Bot Initialization');

  try {
    // Initialize Twitch client first
    logger.sectionHeader('Initializing Twitch Client');
    const twitchClient = await getClient();
    if (!twitchClient || !twitchClient.client) {
      throw new Error('Failed to initialize Twitch client');
    }

    // Initial connection attempt
    await attemptConnection(twitchClient);

    logger.debug('Twitch client initialized:', {
      clientExists: !!twitchClient,
      clientConnected: twitchClient?.client?.isConnected,
      channels: twitchClient?.client?.getChannels?.() || [],
    });

    // Initialize analytics commands with the Twitch client
    logger.sectionHeader('Initializing Analytics Commands');
    try {
      analyticsCommands.initializeAnalytics(twitchClient);
      logger.info('Analytics commands initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize analytics commands:', error);
      throw error;
    }
    // Register message and event handlers
    logger.debug('Setting up message and event handlers');

    // Message handler
    twitchClient.client.onMessage((channel, user, text, msg) => {
      logger.debug('Raw message received:', {
        channel,
        user: JSON.stringify(user),
        text,
        msg: JSON.stringify(msg),
      });

      // Convert  user object to expected format
      const userObj = {
        username: user,
        displayName: msg.userInfo.displayName,
        isMod: msg.userInfo.isMod,
        isBroadcaster: msg.userInfo.badges.has('broadcaster'),
        badges: Object.fromEntries(msg.userInfo.badges),
      };

      handleMessage(twitchClient, channel, userObj, text, msg.userInfo.isSelf);
    });
    logger.debug('Message handler registered');

    // Initialize Spotify integration
    logger.sectionHeader('Initializing Spotify Integration');
    try {
      await spotify.initialize();
      logger.info('Spotify integration initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Spotify integration:', error);
      throw error;
    }

    // Initialize analytics
    logger.sectionHeader('Initializing Analytics');
    try {
      await initializeAnalytics();
      await analytics.initialize();
      await analytics.startStream();
      logger.info('Analytics initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize analytics:', error);
      throw error;
    }

    // Initialize stream automation with the Twitch client
    logger.sectionHeader('Initializing Stream Automation');
    try {
      await streamAutomation.init(twitchClient);
      logger.info('Stream automation initialized');
    } catch (error) {
      logger.error('Failed to initialize stream automation:', error);
      throw error;
    }

    // Set the message handler for twitchClient
    twitchClient.setMessageHandler(handleMessage);
    logger.info('Message handler set for twitchClient');

    // Register stream event handlers
    logger.sectionHeader('Setting Up Event Handlers');
    streamEventHandlers.onStreamStart();

    // Setup cleanup intervals
    logger.sectionHeader('Setting Up Cleanup Intervals');
    setupCleanupIntervals();

    // Setup process termination handler
    logger.sectionHeader('Setting Up Termination Handler');
    setupTerminationHandler(twitchClient);

    logger.startupMessage('Bot Initialization Completed Successfully');
    return twitchClient;
  } catch (error) {
    logger.error('Fatal error during bot initialization:', error);
    try {
      logger.info('Attempting cleanup after initialization failure...');
      streamAutomation.cleanup();
      analytics.cleanup();
      spotify.cleanup();
      logger.info('Cleanup completed');
    } catch (cleanupError) {
      logger.error('Error during cleanup after initialization failure:', cleanupError);
    }
    throw error;
  }
}

async function handleModerationCommand(twitchClient, channel, user, command, args) {
  if (!user.isMod && !user.isBroadcaster) {
    return;
  }

  try {
    switch (command) {
      case '!warn': {
        if (args.length < 2) {
          await twitchClient.client.say(channel, 'Usage: !warn [username] [reason]');
          return;
        }
        const [username, ...reasonParts] = args;
        const reason = reasonParts.join(' ');
        const response = await handleWarn(twitchClient.client, channel, user, [
          username,
          ...reason.split(' '),
        ]);
        if (response) {
          await twitchClient.client.say(channel, String(response));
        }
        break;
      }

      case '!trust': {
        const trustResponse = await handleTrust(twitchClient.client, channel, user, args);
        if (trustResponse) {
          await twitchClient.client.say(channel, String(trustResponse));
        }
        break;
      }

      case '!untrust': {
        const untrustResponse = await handleUntrust(twitchClient.client, channel, user, args);
        if (untrustResponse) {
          await twitchClient.client.say(channel, String(untrustResponse));
        }
        break;
      }

      case '!modstats': {
        const statsResponse = await handleModStats(twitchClient.client, channel, user);
        if (statsResponse) {
          await twitchClient.client.say(channel, String(statsResponse));
        }
        break;
      }

      case '!userhistory': {
        if (!args.length) {
          await twitchClient.client.say(channel, 'Please specify a username to check');
          return;
        }
        const historyResponse = await handleUserHistory(twitchClient.client, channel, user, args[0]);
        if (historyResponse) {
          await twitchClient.client.say(channel, String(historyResponse));
        }
        break;
      }

      case '!raidhistory': {
        const raidResponse = await handleRaidHistory(twitchClient.client, channel, user);
        if (raidResponse) {
          await twitchClient.client.say(channel, String(raidResponse));
        }
        break;
      }

      case '!analyzechat': {
        const analysisResponse = await handleAnalyzeChat(twitchClient.client, channel, user);
        if (analysisResponse) {
          await twitchClient.client.say(channel, String(analysisResponse));
        }
        break;
      }
    }
  } catch (error) {
    logger.error('Error handling moderation command:', error);
  }
}

async function handleCommand(twitchClient, channel, user, message) {
  const [command, ...args] = message.toLowerCase().split(' ');
  const isBroadcaster = user.isBroadcaster || user.username === channel.replace('#', '');

  logger.debug('Processing command:', {
    command,
    args: args.join(' '),
    channel,
    username: user.username,
    isBroadcaster,
    badges: user.badges,
  });

  try {
    // Handle moderation commands first
    const moderationCommands = ['!warn', '!trust', '!untrust', '!modstats', '!userhistory', '!raidhistory', '!analyzechat'];
    if (moderationCommands.includes(command)) {
      await handleModerationCommand(twitchClient, channel, user, command, args);
      return;
    }

    // Handle other commands
    switch (command) {
      case '!ping': {
        const response = handlePing();
        if (response) {
          await twitchClient.client.say(channel, String(response));
        }
        break;
      }

      case '!lurk': {
        const lurkResponse = handleLurk(user.username);
        if (lurkResponse) {
          await twitchClient.client.say(channel, String(lurkResponse));
        }
        logger.debug('Executing lurk command');
        const lurkResponse = await handleLurk(twitchClient.client, channel, user);
        logger.debug('Lurk response:', { response: lurkResponse });
        await twitchClient.client.say(channel, lurkResponse);
        break;
      }

      case '!roast': {
        logger.debug('Executing roast command:', {
          args: args.join(' '),
          username: user.username,
        });
        const roastResponse = await handleRoast(twitchClient.client, channel, user, args.join(' '));
        logger.debug('Roast response:', { response: roastResponse });
        await twitchClient.client.say(channel, roastResponse);
        break;
      }
      case '!clip': {
        const clipResponse = await handleClip(twitchClient, channel, user, args.join(' '));
        if (clipResponse) {
          await twitchClient.client.say(channel, String(clipResponse));
        }
        break;
      }
      case '!highlights': {
        const highlightResponse = await handleHighlights(
          twitchClient,
          channel,
          user,
          args.join(' ')
        );
        if (highlightResponse) {
          await twitchClient.client.say(channel, String(highlightResponse));
        }
        break;
      }
      case '!title': {
        if (isBroadcaster || user.isMod) {
          const response = await handleTitle(twitchClient.client, channel, user, args.join(' '));
          if (response) {
          await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      }
      case '!category': {
        if (isBroadcaster || user.isMod) {
          const response = await handleCategory(twitchClient.client, channel, user, args.join(' '));
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      }

      case '!trust': {
        const trustResponse = await handleTrust(twitchClient.client, channel, user, args);
        if (trustResponse) {
          await twitchClient.client.say(channel, String(trustResponse));
        }
        break;
      }

      case '!untrust': {
        const untrustResponse = await handleUntrust(twitchClient.client, channel, user, args);
        if (untrustResponse) {
          await twitchClient.client.say(channel, String(untrustResponse));
        }
        break;
      }
      case '!suspicious':
        if (isBroadcaster) {
          const response = await handleSuspiciousFollowers(
            twitchClient.client,
            channel,
            user,
            args.join(' ')
          );
          if (response) {
            await twitchClient.client.say(channel, response);
          }
        }
        break;
      case '!clearsuspicious':
        if (isBroadcaster) {
          const response = await handleClearSuspicious(
            twitchClient.client,
            channel,
            user,
            args.join(' ')
          );
          if (response) {
            await twitchClient.client.say(channel, response);
          }
        }
        break;
      case '!followsettings':
        if (isBroadcaster) {
          const response = await handleFollowSettings(
            twitchClient.client,
            channel,
            user,
            args.join(' ')
          );
          if (response) {
            await twitchClient.client.say(channel, response);
          }
        }
        break;
      case '!recommendations': {
        const response = await handleRecommendations(twitchClient.client, channel, user);
        if (response) {
          await twitchClient.client.say(channel, String(response));
        }
        break;
      }
      case '!chatinsights': {
        const response = await handleChatInsights(twitchClient.client, channel, user);
        if (response) {
          await twitchClient.client.say(channel, String(response));
        }
        break;
      }
      case '!stats':
      case '!viewerstats': {
        const response = await handleViewerStats(twitchClient.client, channel, user);
        if (response) {
          await twitchClient.client.say(channel, String(response));
        }
        break;
      }
      case '!loyalty': {
        const response = await handleLoyalty(twitchClient.client, channel, user);
        if (response) {
          await twitchClient.client.say(channel, String(response));
        }
        break;
      }
      case '!topviewers': {
        const response = await handleTopViewers(twitchClient.client, channel, user);
        if (response) {
          await twitchClient.client.say(channel, String(response));
        }
        break;
      }
      case '!raids': {
        const response = await handleRaids(twitchClient.client, channel, user);
        if (response) {
          await twitchClient.client.say(channel, String(response));
        }
        break;
      }
      case '!peak':
      case '!growth':
      case '!trending':
      case '!recap':
      case '!vibe':
      case '!schedule':
      case '!tags':
      case '!collab':
      case '!network': {
        const analyticsCommand = command.substring(1);
        const broadcasterOnlyCommands = ['growth', 'trending', 'schedule', 'tags', 'collab', 'network'];

        // Check if it's a broadcaster-only command
        if (broadcasterOnlyCommands.includes(analyticsCommand) && !isBroadcaster) {
          logger.debug(`User ${user.username} attempted to use broadcaster-only command: ${command}`);
          break;
        }

        // Check if the command exists in analyticsCommands
        if (analyticsCommands[command]) {
          const response = await analyticsCommands[command]();
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      }
      case '!followstats': {
        const response = await handleFollowStats(twitchClient.client, channel, user);
        if (response) {
          await twitchClient.client.say(channel, String(response));
        }
        break;
      }
      case '!followcheck': {
        if (user.isMod || isBroadcaster) {
          const response = await handleFollowCheck(twitchClient.client, channel, user, args);
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      }
      case '!followmode': {
        if (user.isMod || isBroadcaster) {
          const response = await handleFollowMode(twitchClient.client, channel, user, args);
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      }
      case '!streamstats': {
        const response = await handleStreamStats(twitchClient.client, channel, user);
        if (response) {
          await twitchClient.client.say(channel, String(response));
        }
        break;
      }
      case '!streamhealth': {
        const response = await handleStreamHealth(twitchClient.client, channel, user);
        if (response) {
          await twitchClient.client.say(channel, String(response));
        }
        break;
      }
      case '!health': {
        const response = await handleHealth(twitchClient.client, channel, user);
        if (response) {
          await twitchClient.client.say(channel, String(response));
        }
        break;
      }
      case '!hug': {
        const response = await handleHug(twitchClient.client, channel, user, args.join(' '));
        if (response) {
          await twitchClient.client.say(channel, String(response));
        }
        break;
      }
      case '!performancestats': {
        const perfStatsResponse = await handleStreamPerformance(twitchClient.client, channel, user);
        if (perfStatsResponse) {
          await twitchClient.client.say(channel, String(perfStatsResponse));
        }
        break;
      }
      case '!besttimes': {
        const response = await handleBestTimes(twitchClient.client, channel, user);
        if (response) {
          await twitchClient.client.say(channel, String(response));
        }
        break;
      }
      case '!topcategories': {
        const response = await handleTopCategories(twitchClient.client, channel, user);
        if (response) {
          await twitchClient.client.say(channel, String(response));
        }
        break;
      }
      case '!trivia': {
        if (user.isMod || isBroadcaster) {
          const response = await startTrivia(twitchClient.client, channel, user, args.join(' '));
          if (response) {
            await twitchClient.client.say(channel, String(response.message));
          }
        }
        break;
      }
      case '!answer': {
        const response = await handleTriviaAnswer(
          twitchClient.client,
          channel,
          user,
          args.join(' ')
        );
        if (response) {
          await twitchClient.client.say(channel, String(response.message));
        }
        break;
      }
      case '!endtrivia': {
        if (user.isMod || isBroadcaster) {
          const response = await endTrivia(twitchClient.client, channel, user);
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      }
      case '!shoutout':
      case '!so': {
        if (user.isMod || isBroadcaster) {
          if (!args.length) {
            await twitchClient.client.say(channel, 'Please specify a username to shoutout');
            break;
          }
          const response = await handleShoutout(twitchClient, channel, user, args);
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      }
      case '!track':
        if (isBroadcaster) {
          const response = await competitorCommands.handleTrack(twitchClient, channel, user, args);
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      case '!untrack':
        if (isBroadcaster) {
          const response = await competitorCommands.handleUntrack(
            twitchClient,
            channel,
            user,
            args
          );
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      case '!insights':
        if (isBroadcaster) {
          const response = await competitorCommands.handleInsights(twitchClient, channel, user);
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      case '!suggestions':
        if (isBroadcaster) {
          const response = await competitorCommands.handleSuggestions(twitchClient, channel, user);
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      case '!tracked':
        if (isBroadcaster) {
          const response = await competitorCommands.handleTracked(twitchClient, channel, user);
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      case '!songrequest': {
        const username = user.username || '';
        logger.debug('Executing song request command:', {
          args: args.join(' '),
          username,
        });
        await twitchClient.client.say(
          channel,
          `🎵 Checking song "${args.join(' ')}" for ${username}... please wait!`
        );
        const songResponse = await handleSongRequest(username, args.join(' '), twitchClient.client);
        if (typeof songResponse === 'object' && songResponse.message) {
          await twitchClient.client.say(channel, songResponse.message);
        } else {
          await twitchClient.client.say(channel, String(songResponse));
        }
        break;
      }
      case '!queue': {
        const queueResponse = await handleListQueue(
          twitchClient.client,
          channel,
          { username: user.username || user } // Ensure we pass the username correctly
        );
        if (typeof queueResponse === 'object' && queueResponse.message) {
          await twitchClient.client.say(channel, queueResponse.message);
        } else {
          await twitchClient.client.say(channel, String(queueResponse));
        }
        break;
      }
      case '!clearqueue':
        if (user.isMod || isBroadcaster) {
          const clearResponse = await handleClearQueue(user.username);
          await twitchClient.client.say(channel, String(clearResponse.message));
        }
        break;
      case '!queueremove': {
        const removeResponse = await handleRemoveFromQueue(user.username, args[0]);
        await twitchClient.client.say(channel, String(removeResponse.message));
        break;
      }
      case '!addcom':
        if (user.isMod || isBroadcaster) {
          const addResponse = handleAddCommand(
            user.username,
            args,
            user.isMod ? 'mod' : 'broadcaster'
          );
          await twitchClient.client.say(channel, String(addResponse.message));
        }
        break;
      case '!delcom':
        if (user.isMod || isBroadcaster) {
          const delResponse = handleRemoveCommand(
            user.username,
            args,
            user.isMod ? 'mod' : 'broadcaster'
          );
          await twitchClient.client.say(channel, String(delResponse.message));
        }
        break;
      case '!commands': {
        const listResponse = handleUserCommands();
        await twitchClient.client.say(channel, String(listResponse.message));
        break;
      }
      case '!listcommands': {
        const response = handleListCommands();
        if (response) {
          await twitchClient.client.say(channel, String(response.message));
        }
        break;
      }
      case '!mods':
      case '!mod': {
        let userRole = 'everyone';
        if (user.isMod) {
          userRole = 'mod';
        } else if (user.isBroadcaster) {
          userRole = 'broadcaster';
        }
        const modResponse = handleModCommands(userRole);
        await twitchClient.client.say(channel, String(modResponse.message));
        break;
      }
      case '!wordchain': {
        if (user.isMod || isBroadcaster) {
          const response = await handleStartWordChain(
            user.username,
            args,
            user.isMod ? 'mod' : 'broadcaster'
          );
          if (response) {
            await twitchClient.client.say(channel, String(response.message));
          }
        }
        break;
      }
      case '!minigame': {
        if (user.isMod || isBroadcaster) {
          const response = await handleStartMiniGame(
            user.username,
            args,
            user.isMod ? 'mod' : 'broadcaster'
          );
          if (response) {
            await twitchClient.client.say(channel, String(response.message));
          }
        }
        break;
      }
      case '!modstats': {
        if (user.isMod || isBroadcaster) {
          const response = await handleModStats(twitchClient.client, channel, user);
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      }

      case '!userhistory': {
        if (user.isMod || isBroadcaster) {
          if (!args.length) {
            await twitchClient.client.say(channel, 'Please specify a username to check');
            break;
          }
          const response = await handleUserHistory(twitchClient.client, channel, user, args[0]);
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      }
      case '!trust': {
        if (user.isMod || isBroadcaster) {
          if (!args.length) {
            await twitchClient.client.say(channel, 'Please specify a username to trust');
            break;
          }
          const response = await handleTrust(twitchClient.client, channel, user, args[0]);
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      }
      case '!untrust': {
        if (user.isMod || isBroadcaster) {
          if (!args.length) {
            await twitchClient.client.say(channel, 'Please specify a username to untrust');
            break;
          }
          const response = await handleUntrust(twitchClient.client, channel, user, args[0]);
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      }
      case '!raidhistory': {
        if (user.isMod || isBroadcaster) {
          const response = await handleRaidHistory(twitchClient.client, channel, user);
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      }

      case '!analyzechat': {
        if (user.isMod || isBroadcaster) {
          const response = await handleAnalyzeChat(twitchClient.client, channel, user);
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      }
      case '!performance':
        if (user.isMod || isBroadcaster) {
          const response = await handleStreamPerformance(twitchClient.client, channel, user);
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      case '!createclip':
        if (user.isMod || isBroadcaster) {
          const response = await handleCreateClip(
            twitchClient.client,
            channel,
            user,
            args.join(' ')
          );
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      case '!clipsbycategory': {
        if (user.isMod || isBroadcaster) {
          const response = await handleClipsByTag(
            twitchClient.client,
            channel,
            user,
            args.join(' ')
          );
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      }
      case '!clipsbytag': {
        if (user.isMod || isBroadcaster) {
          const response = await handleClipsByTag(
            twitchClient.client,
            channel,
            user,
            args.join(' ')
          );
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      }
      case '!recentclips': {
        const response = await handleRecentClips(
          twitchClient.client,
          channel,
          user,
          args.join(' ')
        );
        if (response) {
          await twitchClient.client.say(channel, String(response));
        }
        break;
      }
      case '!topclips': {
        const response = await handleRecentClips(twitchClient.client, channel, user, 'top');
        const response = await handleTopClips(twitchClient.client, channel, user);
        if (response) {
          await twitchClient.client.say(channel, String(response));
        }
        break;
      }
      case '!clipstats': {
        if (user.isMod || isBroadcaster) {
          const response = await handleClipStats(twitchClient.client, channel, user);
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      }
      case '!suggestcompilation': {
        if (user.isMod || isBroadcaster) {
          const response = await handleSuggestCompilation(twitchClient.client, channel, user);
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      }
      case '!analyzeclip': {
        if (user.isMod || isBroadcaster) {
          const response = await handleAnalyzeClip(
            twitchClient.client,
            channel,
            user,
            args.join(' ')
          );
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
      }
      case '!chatactivity':
        if (user.isMod || isBroadcaster) {
          const activityResponse = await handleChatActivity(
            twitchClient.client,
            channel,
            user,
            args.join(' ')
          );
          if (activityResponse) {
            await twitchClient.client.say(channel, String(activityResponse));
          }
        }
        break;
      case '!viewer': {
        const viewerResponse = await viewerCommands.handleViewer(
          twitchClient.client,
          channel,
          user,
          args
        );
        if (viewerResponse) {
          await twitchClient.client.say(channel, String(viewerResponse));
        }
        break;
      }
      case '!analytics':
        if (isBroadcaster) {
          const analyticsResponse = await analyticsCommands.handleAnalytics(
            twitchClient.client,
            channel,
            user,
            args
          );
          if (analyticsResponse) {
            await twitchClient.client.say(channel, String(analyticsResponse));
          }
        }
        break;
      case '!stream':
        if (isBroadcaster) {
          const streamResponse = await streamCommands.handleStream(
            twitchClient.client,
            channel,
            user,
            args
          );
          if (streamResponse) {
            await twitchClient.client.say(channel, String(streamResponse));
          }
        }
        break;
      case '!categories': {
        const categoriesResponse = await streamCommands.listCategories();
        if (categoriesResponse) {
          await twitchClient.client.say(channel, String(categoriesResponse));
        }
        break;
      }
      default:
        // Handle unknown command
        break;
      case '!warn': {
        if (user.isMod || isBroadcaster) {
          if (args.length < 2) {
            await twitchClient.client.say(channel, 'Usage: !warn [username] [reason]');
            break;
          }
          const username = args[0];
          const reason = args.slice(1).join(' ');
          const response = await handleWarn(twitchClient.client, channel, user, [
            username,
            ...reason.split(' '),
          ]);
          if (response) {
            await twitchClient.client.say(channel, String(response));
          }
        }
        break;
    }
  } catch (error) {
    logger.error('Error handling command:', error);
  }
}

function setupCleanupIntervals() {
  setInterval(
    () => {
      try {
        analytics.cleanup();
      } catch (error) {
        logger.error('Error in analytics cleanup:', error);
      }
    },
    24 * 60 * 60 * 1000
  );

  setInterval(
    () => {
      try {
        competitorManager.updateAllChannels(twitchClient);
      } catch (error) {
        logger.error('Error updating competitor analysis:', error);
      }
    },
    60 * 60 * 1000
  );

  // Update competitor analysis less frequently to avoid rate limits
  setInterval(
    () => {
      try {
        competitorAnalysis.updateAllChannels().catch((error) => {
          logger.error('Error in competitor analysis update:', error);
        });
      } catch (error) {
        logger.error('Error in competitor analysis interval:', error);
      }
    },
    15 * 60 * 1000
  ); // Run every 15 minutes instead of every hour
}

function setupTerminationHandler(twitchClient) {
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT signal, starting cleanup...');
    try {
      logger.info('Starting stream cleanup process...');

      // Set up event listener first
      logger.info('Setting up stream end event listener...');
      const streamInsights = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          logger.warn('Stream insights timeout, proceeding with null');
          resolve(null);
        }, 5000);

        streamManager.once('streamEnd', (insights) => {
          clearTimeout(timeout);
          logger.info('Received stream end event with insights');
          resolve(insights);
        });

        // Now trigger the stream end
        logger.info('Triggering stream end event...');
        streamEventHandlers.onStreamEnd();
      });
      logger.info('Stream insights received:', streamInsights ? 'success' : 'no data');
      logger.info('Stream insights received:', streamInsights ? 'success' : 'no data');

      logger.info('Running analytics cleanup...');
      analytics.endStream();
      const analyticsData = await endAnalytics();

      // Combine analytics data with stream insights
      const finalAnalysis = {
        ...analyticsData,
        ...streamInsights,
      };

      logger.debug('Final analysis data:', {
        analyticsData,
        streamInsights,
        finalAnalysis,
      });

      const channelName = process.env.CHANNEL_NAME || process.env.TWITCH_CHANNEL;
      const channelName = process.env.CHANNEL_NAME || process.env.TWITCH_CHANNEL;
      if (finalAnalysis && twitchClient?.client?.isConnected && channelName) {
        logger.info('Posting final stream analysis...');
        const duration =
          streamCommands.uptime() === 'Stream is offline' ? '0h 0m' : streamCommands.uptime();
          streamCommands.uptime() === 'Stream is offline' ? '0h 0m' : streamCommands.uptime();
        const message = formatEndStreamMessage(finalAnalysis, duration);
        try {
          await twitchClient.client.say(`#${channelName}`, message);
          logger.info('Final stream analysis posted successfully');
        } catch (error) {
          logger.error('Error posting final stream analysis:', error);
        }
      } else {
        logger.warn('Skipping final analysis post:', {
          hasAnalysis: !!finalAnalysis,
          isConnected: twitchClient?.client?.isConnected,
          hasChannel: !!channelName,
        });
      }
      logger.info('Cleanup completed, waiting for final message to send...');
      // Give time for the final message to be sent
      await new Promise((resolve) => setTimeout(resolve, 1000));
      logger.info('Exiting...');
      process.exit(0);
    } catch (error) {
      logger.error('Error during cleanup:', error);
      // Still give a moment for any error logs to be written
      await new Promise((resolve) => setTimeout(resolve, 1000));
      process.exit(1);
    }
  });
}

function formatEndStreamMessage(analysis, duration) {
  if (!analysis?.health || !analysis?.stats || !analysis?.performance) {
    logger.error('Invalid analysis data:', analysis);
    return 'Stream ended! (Error: Unable to generate full analysis)';
  }

  return [
    'Stream ended! Final stream analysis:',
    `• Stream Health: ${analysis.health.status} (Score: ${analysis.health.score}/100)`,
    `• Stream Duration: ${duration}`,
    `• Bitrate: ${analysis.health.bitrate.average}kbps (${analysis.health.bitrate.stability})`,
    `• Peak Viewers: ${analysis.stats.peakViewers}`,
    `• Average Viewers: ${analysis.stats.averageViewers}`,
    `• Best Category: ${analysis.performance.bestCategory}`,
    `• Viewer Retention: ${analysis.performance.viewerRetention}%`,
    `• Engagement Rate: ${analysis.performance.averageEngagement}%`,
    `• Total Chat Messages: ${analysis.stats.totalMessages}`,
    `• Most Active Chatters: ${analysis.stats.activeViewers.join(', ')}`,
    '',
    'Top Suggestions:',
    ...analysis.performance.improvements.slice(0, 2).map((imp) => `• ${imp}`),
    '',
    'Check !insights for more detailed analytics!',
  ].join('\n');
}

async function attemptConnection(twitchClient) {
  try {
    // Check if already connected
    if (twitchClient.client.isConnected) {
      logger.info('Already connected to Twitch chat');
      return;
    }

    logger.info('Connecting to Twitch chat...');
    // Connect with timeout
    await Promise.race([
      twitchClient.client.connect(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      ),
    ]);

    // Wait for channel join
    logger.info('Waiting for channel join...');
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Channel join timeout'));
      }, 10000);

      const joinHandler = (channel, user) => {
        if (user === twitchClient.client.currentNick) {
          clearTimeout(timeout);
          twitchClient.client.removeListener('join', joinHandler);
          logger.info(`Successfully joined channel ${channel}`);
          resolve();
        }
      };

      twitchClient.client.onJoin(joinHandler);
    });
  } catch (error) {
    logger.error('Connection attempt failed:', error);
    // If connection fails, ensure we're disconnected before retrying
    if (twitchClient.client.isConnected) {
      try {
        await twitchClient.client.quit();
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (disconnectError) {
        logger.error('Error during disconnect:', disconnectError);
      }
    }
    throw error; // Re-throw to be handled by retry logic
  }
}

export { initBot };
