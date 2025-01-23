import { renderTemplate, broadcastUpdate } from '../overlays/overlays.js';
import logger from '../utils/logger.js';
import twitchClient from './twitchClient.js';
import chatInteraction from './chatInteraction.js';
import channelPoints from './channelPoints.js';
import analytics from './analytics.js';
import customCommands, {
  handleAddCommand,
  handleRemoveCommand,
} from './commands/customCommands.js';
import chatGames, {
  handleStartTrivia,
  handleStartWordChain,
  handleStartMiniGame,
  handleAnswer,
} from './commands/games.js';
import { handleStreamInsights } from './commands/streamInsights.js';
import {
  handlePing,
  handleRoast,
  handleListQueue,
  handleClearQueue,
  handleRemoveFromQueue,
  handleSongRequest,
  processSongQueue,
  commandList,
} from './commands/index.js';

// Setup message handler
function setupMessageHandler() {
  twitchClient.client.on('message', async (channel, tags, message, self) => {
    if (self) {
      return;
    }

    try {
      // Check for game answers or witty responses if not a command
      if (!message.startsWith('!')) {
        // Check for game answers first
        const gameResponse = handleAnswer(tags.username, message);
        if (gameResponse) {
          twitchClient.client.say(channel, gameResponse.message);
          return;
        }

        // Then check for witty responses
        const wittyResponse = await chatInteraction.getWittyResponse(message, tags.username);
        if (wittyResponse) {
          twitchClient.client.say(channel, wittyResponse);
          return;
        }
      }

      let response = null;
      let command = null;
      let args = [];

      if (message.startsWith('!')) {
        command = message.split(' ')[0].toLowerCase();
        args = message.split(' ').slice(1);

        // Get stats data outside switch to avoid lexical declarations in case blocks
        const stats = analytics.getEngagementStats();
        const topChatters = stats.topChatters.slice(0, 3);
        const bestTimes = analytics.getBestStreamingTimes();

        switch (command) {
          case '!ping':
            response = handlePing();
            break;

          case '!commands':
            response = {
              success: true,
              message: `Available commands: ${commandList} | Custom commands: ${customCommands.listCommands().join(', ')}`,
            };
            break;

          case '!addcom':
            if (args.length >= 2) {
              response = await handleAddCommand(tags.username, args, tags.mod ? 'mod' : 'user');
            } else {
              response = {
                success: false,
                message: 'Usage: !addcom [command] [response]',
              };
            }
            break;

          case '!delcom':
            if (args.length >= 1) {
              response = await handleRemoveCommand(tags.username, args, tags.mod ? 'mod' : 'user');
            } else {
              response = {
                success: false,
                message: 'Usage: !delcom [command]',
              };
            }
            break;

          case '!stats':
            response = {
              success: true,
              message: `Stream Stats 📊 | Viewers: ${stats.currentViewers} | Peak: ${stats.peakViewers} | Active Chatters: ${stats.activeLastHour} | Top Command: ${stats.popularCommands[0]?.[0] || 'None'}`,
            };
            break;

          case '!topchatter':
            response = {
              success: true,
              message: `Top Chatters 🏆 | ${topChatters.map((c, i) => `${i + 1}. ${c.username} (${c.messages} msgs)`).join(' | ')}`,
            };
            break;

          case '!besttime':
            response = {
              success: true,
              message: `Best Stream Times 🕒 | ${bestTimes.map((t) => `${t.time} (${t.averageViewers} avg viewers)`).join(' | ')}`,
            };
            break;

          case '!songrequest':
            if (args.length > 0) {
              response = await handleSongRequest(tags.username, args.join(' '), twitchClient);
              if (response.success) {
                const queueContent = renderTemplate('queue', {
                  songs: JSON.stringify(response.song),
                });
                broadcastUpdate(queueContent);
              }
            } else {
              response = {
                success: false,
                message: 'Usage: !songrequest [song name]',
              };
            }
            break;

          case '!queue':
            response = handleListQueue();
            break;

          case '!queueclear':
            response = handleClearQueue(tags.username);
            break;

          case '!queueremove':
            if (args.length > 0) {
              const index = parseInt(args[0], 10);
              response = handleRemoveFromQueue(tags.username, index);
            } else {
              response = {
                success: false,
                message: 'Usage: !queueremove [position number]',
              };
            }
            break;

          case '!roast':
            if (args.length > 0) {
              const targetUser = args[0].replace('@', '');
              response = await handleRoast(twitchClient, channel, targetUser);
            } else {
              response = {
                success: false,
                message: 'Usage: !roast @username',
              };
            }
            break;

          case '!trivia':
            response = await handleStartTrivia(tags.username, args, tags.mod ? 'mod' : 'user');
            break;

          case '!wordchain':
            response = await handleStartWordChain(tags.username, args, tags.mod ? 'mod' : 'user');
            break;

          case '!minigame':
            response = await handleStartMiniGame(tags.username, args, tags.mod ? 'mod' : 'user');
            break;

          case '!insights':
            response = await handleStreamInsights(
              tags.username,
              args,
              'broadcaster',
              twitchClient.twitchApi
            );
            break;
        }

        if (response) {
          twitchClient.client.say(channel, response.message);
        }
        // Handle custom commands
        const customResponse = customCommands.handleCommand(command, tags.mod ? 'mod' : 'user');
        if (customResponse) {
          response = customResponse;
        }
      }

      // Track analytics and game stats
      if (command) {
        analytics.trackViewer(tags.username, 'command');
        analytics.trackCommand(command);
        chatGames.trackActivity(tags.username, 'command');
      } else {
        analytics.trackViewer(tags.username, 'chat');
        chatGames.trackActivity(tags.username, 'chat');
      }
    } catch (error) {
      logger.error('Error in message handler:', error);
    }
  });

  // Handle channel point redemptions
  twitchClient.client.on('redeem', async (channel, username, rewardType, tags, message) => {
    try {
      const result = await channelPoints.handleRedemption(
        rewardType,
        username,
        message,
        twitchClient.twitchApi
      );

      if (result.success) {
        twitchClient.client.say(channel, result.message);
      }
    } catch (error) {
      logger.error('Error handling channel point redemption:', error);
    }
  });
}

// Setup handlers and process queue
setupMessageHandler();

// Start analytics tracking
analytics.startStream();

// Setup intervals
setInterval(() => {
  if (twitchClient.client) {
    processSongQueue();
  }
}, 30000);

// Clean up analytics data periodically
setInterval(
  () => {
    analytics.cleanup();
  },
  24 * 60 * 60 * 1000
); // Once per day

// Handle stream end
process.on('SIGINT', () => {
  analytics.endStream();
  process.exit();
});

export { twitchClient };
