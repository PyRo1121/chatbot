import getClient from './twitchClient.js';
import analytics, { initializeAnalytics, endAnalytics } from './analytics.js';
import chatInteraction from './chatInteraction.js';
import competitorAnalysis from './competitorAnalysis.js';
import { trackViewer } from './viewerManager.js';
import streamAutomation from './streamAutomation.js';
import spotify from '../spotify/spotify.js';
import logger from '../utils/logger.js';
import {
  handlePing,
  handleLurk,
  handleRoast,
  handleChatActivity,
  streamEventHandlers,
  handleClip,
  handleHighlights,
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
  analyticsCommands,
  handleStreamHealth,
  handleStreamStats,
  handleStreamPerformanceStats,
} from './commands/index.js';
import streamManager, {
  detectHighlight,
  streamCommands,
} from './streamManager.js';

async function handleMessage(twitchClient, channel, user, message, self) {
  if (!twitchClient?.client) {
    logger.error('No valid Twitch client provided to handleMessage');
    return;
  }

  if (!user?.username || typeof user.username !== 'string') {
    logger.error('No valid user object provided to handleMessage:', { user });
    return;
  }

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
      const engagementResponse = await chatInteraction.handleChatMessage(
        user.username,
        message
      );
      if (engagementResponse) {
        await twitchClient.client.say(channel, engagementResponse);
      }
    } catch (error) {
      logger.error('Error in chat engagement:', error);
    }

    // Track viewer activity
    try {
      const milestone = trackViewer(user.username);
      if (milestone) {
        await twitchClient.client.say(channel, milestone);
      }
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

    logger.debug('Twitch client initialized:', {
      clientExists: !!twitchClient,
      clientConnected: twitchClient?.client?.isConnected,
      channels: twitchClient?.client?.getChannels?.() || [],
    });

    // Register message handler
    logger.debug('Setting up message handler');
    twitchClient.client.onMessage((channel, user, text, msg) => {
      logger.debug('Raw message received:', {
        channel,
        user: JSON.stringify(user),
        text,
        msg: JSON.stringify(msg),
      });

      // Convert Twurple user object to expected format
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

    // Initialize stream automation with the Twitch client
    logger.sectionHeader('Initializing Stream Automation');
    try {
      await streamAutomation.init(twitchClient);
    } catch (error) {
      logger.error('Failed to initialize stream automation:', error);
      throw error;
    }

    // Start analytics tracking
    logger.sectionHeader('Starting Analytics');
    analytics.startStream();
    initializeAnalytics();

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
      logger.error(
        'Error during cleanup after initialization failure:',
        cleanupError
      );
    }
    throw error;
  }
}

async function handleCommand(twitchClient, channel, user, message) {
  const [command, ...args] = message.toLowerCase().split(' ');
  const isBroadcaster =
    user.isBroadcaster || user.username === channel.replace('#', '');

  logger.debug('Processing command:', {
    command,
    args: args.join(' '),
    channel,
    username: user.username,
    isBroadcaster,
    badges: user.badges,
  });

  try {
    switch (command) {
      case '!ping': {
        logger.debug('Executing ping command');
        const pingResponse = handlePing();
        logger.debug('Ping response:', { response: pingResponse });
        await twitchClient.client.say(channel, pingResponse);
        break;
      }
      case '!lurk': {
        logger.debug('Executing lurk command');
        const lurkResponse = await handleLurk(
          twitchClient.client,
          channel,
          user
        );
        logger.debug('Lurk response:', { response: lurkResponse });
        await twitchClient.client.say(channel, lurkResponse);
        break;
      }
      case '!roast': {
        logger.debug('Executing roast command:', {
          args: args.join(' '),
          username: user.username,
        });
        const roastResponse = await handleRoast(
          twitchClient.client,
          channel,
          user,
          args.join(' ')
        );
        logger.debug('Roast response:', { response: roastResponse });
        await twitchClient.client.say(channel, roastResponse);
        break;
      }
      case '!clip':
        await handleClip(twitchClient, channel, user, args.join(' '));
        break;
      case '!highlights':
        await handleHighlights(twitchClient, channel, user, args.join(' '));
        break;
      case '!title':
        if (isBroadcaster || user.isMod) {
          await handleTitle(twitchClient.client, channel, user, args.join(' '));
        }
        break;
      case '!category':
        if (isBroadcaster || user.isMod) {
          await handleCategory(
            twitchClient.client,
            channel,
            user,
            args.join(' ')
          );
        }
        break;
      case '!uptime':
        await handleUptime(twitchClient.client, channel, user, args.join(' '));
        break;
      case '!milestone':
        if (isBroadcaster || user.isMod) {
          await handleMilestone(
            twitchClient.client,
            channel,
            user,
            args.join(' ')
          );
        }
        break;
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
      case '!recommendations':
        await twitchClient.client.say(channel, await handleRecommendations());
        break;
      case '!stats':
      case '!viewerstats':
        await twitchClient.client.say(channel, await handleViewerStats());
        break;
      case '!loyalty':
        await twitchClient.client.say(channel, await handleLoyalty());
        break;
      case '!topviewers':
        await twitchClient.client.say(channel, await handleTopViewers());
        break;
      case '!raids':
        await twitchClient.client.say(channel, await handleRaids());
        break;
      case '!peak':
        await twitchClient.client.say(
          channel,
          await analyticsCommands['!peak']()
        );
        break;
      case '!growth':
        if (isBroadcaster) {
          await twitchClient.client.say(
            channel,
            await analyticsCommands['!growth']()
          );
        }
        break;
      case '!trending':
        if (isBroadcaster) {
          await twitchClient.client.say(
            channel,
            await analyticsCommands['!trending']()
          );
        }
        break;
      case '!recap':
        await twitchClient.client.say(
          channel,
          await analyticsCommands['!recap']()
        );
        break;
      case '!vibe':
        await twitchClient.client.say(
          channel,
          await analyticsCommands['!vibe']()
        );
        break;
      case '!schedule':
        if (isBroadcaster) {
          await twitchClient.client.say(
            channel,
            await analyticsCommands['!schedule']()
          );
        }
        break;
      case '!tags':
        if (isBroadcaster || user.isMod) {
          await twitchClient.client.say(
            channel,
            await analyticsCommands['!tags']()
          );
        }
        break;
      case '!collab':
        if (isBroadcaster) {
          await twitchClient.client.say(
            channel,
            await analyticsCommands['!collab']()
          );
        }
        break;
      case '!network':
        if (isBroadcaster) {
          await twitchClient.client.say(
            channel,
            await analyticsCommands['!network']()
          );
        }
        break;
      case '!followstats':
        await twitchClient.client.say(
          channel,
          await handleFollowStats(twitchClient.client, channel, user)
        );
        break;
      case '!followcheck':
        if (user.isMod || isBroadcaster) {
          await twitchClient.client.say(
            channel,
            await handleFollowCheck(twitchClient.client, channel, user, args)
          );
        }
        break;
      case '!followmode':
        if (user.isMod || isBroadcaster) {
          await twitchClient.client.say(
            channel,
            await handleFollowMode(twitchClient.client, channel, user, args)
          );
        }
        break;
      case '!streamstats':
        await twitchClient.client.say(
          channel,
          await handleStreamStats(twitchClient.client, channel, user)
        );
        break;
      case '!streamhealth':
        await twitchClient.client.say(
          channel,
          await handleStreamHealth(twitchClient.client, channel, user)
        );
        break;
      case '!health':
        await twitchClient.client.say(channel, await handleHealth());
        break;
      case '!performance':
        await twitchClient.client.say(
          channel,
          await handleStreamPerformanceStats(twitchClient.client, channel, user)
        );
        break;
      case '!besttimes':
        await twitchClient.client.say(channel, await handleBestTimes());
        break;
      case '!topcategories':
        await twitchClient.client.say(channel, await handleTopCategories());
        break;
      case '!trivia': {
        if (user.isMod || isBroadcaster) {
          await twitchClient.client.say(
            channel,
            await startTrivia(
              twitchClient.client,
              channel,
              user,
              args.join(' ')
            )
          );
        }
        break;
      }
      case '!answer': {
        const answerResponse = await handleTriviaAnswer(
          twitchClient.client,
          channel,
          user,
          args.join(' ')
        );
        if (answerResponse) {
          await twitchClient.client.say(channel, answerResponse);
        }
        break;
      }
      case '!endtrivia':
        if (user.isMod || isBroadcaster) {
          await twitchClient.client.say(
            channel,
            await endTrivia(twitchClient.client, channel, user)
          );
        }
        break;
      case '!shoutout':
      case '!so': {
        if (user.isMod || isBroadcaster) {
          if (!args.length) {
            await twitchClient.client.say(
              channel,
              'Please specify a username to shoutout'
            );
            break;
          }
          await handleShoutout(twitchClient, channel, user, args);
        }
        break;
      }
      case '!track':
        if (isBroadcaster) {
          const response = await competitorCommands.handleTrack(
            twitchClient,
            channel,
            user,
            args
          );
          if (response) {
            await twitchClient.client.say(channel, response);
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
            await twitchClient.client.say(channel, response);
          }
        }
        break;
      case '!insights':
        if (isBroadcaster) {
          const response = await competitorCommands.handleInsights(
            twitchClient,
            channel,
            user
          );
          if (response) {
            await twitchClient.client.say(channel, response);
          }
        }
        break;
      case '!suggestions':
        if (isBroadcaster) {
          const response = await competitorCommands.handleSuggestions(
            twitchClient,
            channel,
            user
          );
          if (response) {
            await twitchClient.client.say(channel, response);
          }
        }
        break;
      case '!tracked':
        if (isBroadcaster) {
          const response = await competitorCommands.handleTracked(
            twitchClient,
            channel,
            user
          );
          if (response) {
            await twitchClient.client.say(channel, response);
          }
        }
        break;
      case '!songrequest': {
        logger.debug('Executing song request command:', {
          args: args.join(' '),
          username: user.username,
        });
        const songResponse = await handleSongRequest(
          user.username,
          args.join(' '),
          twitchClient
        );
        if (songResponse) {
          await twitchClient.client.say(channel, songResponse.message);
        }
        break;
      }
      case '!queue': {
        const queueResponse = handleListQueue();
        await twitchClient.client.say(channel, queueResponse.message);
        break;
      }
      case '!clearqueue':
        if (user.isMod || isBroadcaster) {
          const clearResponse = handleClearQueue(user.username);
          await twitchClient.client.say(channel, clearResponse.message);
        }
        break;
      case '!queueremove': {
        const removeResponse = handleRemoveFromQueue(user.username, args[0]);
        await twitchClient.client.say(channel, removeResponse.message);
        break;
      }
      case '!addcom':
        if (user.isMod || isBroadcaster) {
          const addResponse = handleAddCommand(
            user.username,
            args,
            user.isMod ? 'mod' : 'broadcaster'
          );
          await twitchClient.client.say(channel, addResponse.message);
        }
        break;
      case '!delcom':
        if (user.isMod || isBroadcaster) {
          const delResponse = handleRemoveCommand(
            user.username,
            args,
            user.isMod ? 'mod' : 'broadcaster'
          );
          await twitchClient.client.say(channel, delResponse.message);
        }
        break;
      case '!commands': {
        const listResponse = handleUserCommands();
        await twitchClient.client.say(channel, listResponse.message);
        break;
      }
      case '!mod': {
        const modResponse = handleModCommands(
          user.isMod ? 'mod' : user.isBroadcaster ? 'broadcaster' : 'everyone'
        );
        await twitchClient.client.say(channel, modResponse.message);
        break;
      }
      case '!wordchain':
        if (user.isMod || isBroadcaster) {
          const chainResponse = await handleStartWordChain(
            user.username,
            args,
            user.isMod ? 'mod' : 'broadcaster'
          );
          await twitchClient.client.say(channel, chainResponse.message);
        }
        break;
      case '!minigame':
        if (user.isMod || isBroadcaster) {
          const gameResponse = await handleStartMiniGame(
            user.username,
            args,
            user.isMod ? 'mod' : 'broadcaster'
          );
          await twitchClient.client.say(channel, gameResponse.message);
        }
        break;
      case '!modstats':
        if (user.isMod || isBroadcaster) {
          const response = await handleModStats(
            twitchClient.client,
            channel,
            user
          );
          if (response) {
            await twitchClient.client.say(channel, response);
          }
        }
        break;
      case '!userhistory':
        if (user.isMod || isBroadcaster) {
          if (!args.length) {
            await twitchClient.client.say(
              channel,
              'Please specify a username to check'
            );
            break;
          }
          const response = await handleUserHistory(
            twitchClient.client,
            channel,
            user,
            args[0]
          );
          if (response) {
            await twitchClient.client.say(channel, response);
          }
        }
        break;
      case '!trust':
        if (user.isMod || isBroadcaster) {
          if (!args.length) {
            await twitchClient.client.say(
              channel,
              'Please specify a username to trust'
            );
            break;
          }
          const response = await handleTrust(
            twitchClient.client,
            channel,
            user,
            args[0]
          );
          if (response) {
            await twitchClient.client.say(channel, response);
          }
        }
        break;
      case '!untrust':
        if (user.isMod || isBroadcaster) {
          if (!args.length) {
            await twitchClient.client.say(
              channel,
              'Please specify a username to untrust'
            );
            break;
          }
          const response = await handleUntrust(
            twitchClient.client,
            channel,
            user,
            args[0]
          );
          if (response) {
            await twitchClient.client.say(channel, response);
          }
        }
        break;
      case '!raidhistory':
        if (user.isMod || isBroadcaster) {
          const response = await handleRaidHistory(
            twitchClient.client,
            channel,
            user
          );
          if (response) {
            await twitchClient.client.say(channel, response);
          }
        }
        break;
      case '!analyzechat':
        if (user.isMod || isBroadcaster) {
          const response = await handleAnalyzeChat(
            twitchClient.client,
            channel,
            user
          );
          if (response) {
            await twitchClient.client.say(channel, response);
          }
        }
        break;
      case '!warn':
        if (user.isMod || isBroadcaster) {
          if (args.length < 2) {
            await twitchClient.client.say(
              channel,
              'Usage: !warn [username] [reason]'
            );
            break;
          }
          const username = args[0];
          const reason = args.slice(1).join(' ');
          const response = await handleWarn(
            twitchClient.client,
            channel,
            user,
            username,
            reason
          );
          if (response) {
            await twitchClient.client.say(channel, response);
          }
        }
        break;
    }
  } catch (error) {
    logger.error(`Error handling command ${command}:`, error);
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
        competitorAnalysis.updateAllChannels();
      } catch (error) {
        logger.error('Error updating competitor analysis:', error);
      }
    },
    60 * 60 * 1000
  );
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
      
      logger.info('Running analytics cleanup...');
      analytics.endStream();
      const analyticsData = await endAnalytics();

      // Combine analytics data with stream insights
      const finalAnalysis = {
        ...analyticsData,
        ...streamInsights
      };
      
      logger.debug('Final analysis data:', {
        analyticsData,
        streamInsights,
        finalAnalysis
      });

      const channelName = process.env.CHANNEL_NAME || process.env.TWITCH_CHANNEL;
      if (finalAnalysis && twitchClient?.client?.isConnected && channelName) {
        logger.info('Posting final stream analysis...');
        const duration = streamCommands.uptime() === 'Stream is offline'
          ? '0h 0m'
          : streamCommands.uptime();
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
          hasChannel: !!channelName
        });
      }
      logger.info('Cleanup completed, waiting for final message to send...');
      // Give time for the final message to be sent
      await new Promise(resolve => setTimeout(resolve, 1000));
      logger.info('Exiting...');
      process.exit(0);
    } catch (error) {
      logger.error('Error during cleanup:', error);
      // Still give a moment for any error logs to be written
      await new Promise(resolve => setTimeout(resolve, 1000));
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

export { initBot };
