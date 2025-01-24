import tmi from 'tmi.js';
import { ApiClient } from '@twurple/api';
import { RefreshingAuthProvider } from '@twurple/auth';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import logger from '../utils/logger.js';
import { OpenAI } from 'openai';
import tokenManager from '../auth/tokenManager.js';
import followProtection from './followProtection.js';
import { renderTemplate, broadcastUpdate } from '../overlays/overlays.js';
import chatInteraction from './chatInteraction.js';
import analytics from './analytics.js';
import channelPoints from './channelPoints.js';
import customCommands, {
  handleAddCommand,
  handleRemoveCommand,
} from './commands/customCommands.js';
import chatGames, {
  handleStartTrivia,
  handleStartWordChain,
  handleStartMiniGame,
  handleAnswer as handleGameAnswer,
} from './commands/games.js';
import { handleStreamInsights } from './commands/streamInsights.js';
import {
  handlePing,
  handleRoast,
  handleListQueue,
  handleClearQueue,
  handleRemoveFromQueue,
  handleSongRequest,
  commandList,
} from './commands/index.js';

class TwitchClient {
  // Stream analytics data
  streamAnalytics = {
    totalStreams: 0,
    totalHours: 0,
    averageViewers: 0,
    peakViewers: 0,
    gamesPlayed: new Map(),
    bestTimes: new Map(),
    lastStream: null,
  };

  // Twitch API clients and subscriptions
  twitchApi = null;
  broadcasterApi = null;
  eventSubListener = null;
  followSubscription = null;
  redemptionSubscription = null;
  async init() {
    // Get tokens from token manager
    const botTokens = await tokenManager.getBotTokens();
    const broadcasterTokens = await tokenManager.getBroadcasterTokens();

    // Initialize bot auth provider
    const botAuthProvider = new RefreshingAuthProvider({
      clientId: botTokens.clientId,
      clientSecret: botTokens.clientSecret,
      onRefresh: async (userId, newTokenData) => {
        try {
          await tokenManager.updateBotTokens(newTokenData);
          logger.info('Bot Twitch token refreshed successfully via auth provider');
        } catch (error) {
          logger.error('Error in auth provider refresh:', error);
          throw error;
        }
      },
    });

    // Add bot credentials to auth provider
    await botAuthProvider.addUserForToken(
      {
        accessToken: botTokens.accessToken,
        refreshToken: botTokens.refreshToken,
        expiresIn: 0,
        obtainmentTimestamp: 0,
        scope: ['chat:read', 'chat:edit', 'channel:moderate', 'whispers:read', 'whispers:edit'],
      },
      ['chat']
    );

    // Initialize broadcaster auth provider
    const broadcasterAuthProvider = new RefreshingAuthProvider({
      clientId: broadcasterTokens.clientId,
      clientSecret: broadcasterTokens.clientSecret,
      onRefresh: async (userId, newTokenData) => {
        try {
          await tokenManager.updateBroadcasterTokens(newTokenData);
          logger.info('Broadcaster Twitch token refreshed successfully');
        } catch (error) {
          logger.error('Error in broadcaster auth provider refresh:', error);
          throw error;
        }
      },
    });

    // Create temporary API client to get user ID
    const tempApi = new ApiClient({ authProvider: broadcasterAuthProvider });
    const broadcaster = await tempApi.users.getUserByName(
      broadcasterTokens.channel.replace('#', '')
    );
    if (!broadcaster) {
      throw new Error('Could not find broadcaster user');
    }

    // Add broadcaster credentials to auth provider with user ID
    await broadcasterAuthProvider.addUserForToken(
      {
        accessToken: broadcasterTokens.accessToken,
        refreshToken: broadcasterTokens.refreshToken,
        expiresIn: 14400, // 4 hours in seconds
        obtainmentTimestamp: Date.now(),
        userId: broadcaster.id,
        scope: [
          'channel:read:subscriptions',
          'channel:read:redemptions',
          'channel:manage:redemptions',
          'channel:read:vips',
          'channel:manage:vips',
          'channel:moderate',
          'channel:read:followers',
          'moderator:read:followers',
          'channel:read:stream_key',
          'channel:read:subscriptions',
          'channel:read:vips',
          'moderator:read:chatters',
          'user:read:follows',
          'user:read:subscriptions',
          'user:read:email',
          'user:read:broadcast',
          'whispers:read',
          'whispers:edit',
          'channel:read:follows',
          'channel:read:goals',
          'channel:read:polls',
          'channel:read:predictions',
        ],
      },
      ['chat']
    );

    // Initialize API clients with authenticated user
    this.twitchApi = new ApiClient({ authProvider: botAuthProvider });
    this.broadcasterApi = new ApiClient({
      authProvider: broadcasterAuthProvider,
      authId: broadcaster.id, // Set authenticated user ID
    });

    // Initialize chat client with robust connection options
    this.client = new tmi.Client({
      options: {
        debug: true,
        skipMembership: true, // Skip membership spam
        skipUpdatingEmotesets: true, // Skip emote updates
      },
      connection: {
        secure: true,
        reconnect: true,
        maxReconnectAttempts: 2,
        maxReconnectInverval: 30000,
        reconnectDecay: 1.5,
        reconnectInterval: 1000,
        timeout: 9999,
      },
      identity: {
        username: botTokens.username,
        password: `oauth:${botTokens.accessToken}`,
      },
      channels: [`#${broadcasterTokens.channel}`],
    });

    // Initialize OpenAI client (using env directly since it's not part of Twitch API)
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    await this.setupEventHandlers(
      botTokens,
      broadcasterTokens,
      broadcaster,
      broadcasterAuthProvider
    );
    return this;
  }

  async setupEventHandlers(botTokens, broadcasterTokens, broadcaster, broadcasterAuthProvider) {
    // Chat event handlers
    this.client.on('message', this.handleError(this.onMessageHandler.bind(this)));
    this.client.on('subscription', this.handleError(this.onSubscription.bind(this)));
    this.client.on('resub', this.handleError(this.onResub.bind(this)));
    this.client.on('raid', this.handleError(this.onRaid.bind(this)));
    this.client.on('error', this.handleTwitchError.bind(this));

    try {
      // Create a dedicated API client for EventSub using broadcaster auth
      const eventSubClient = new ApiClient({
        authProvider: broadcasterAuthProvider,
        authId: broadcaster.id,
      });

      // Set up WebSocket-based EventSub listener
      this.eventSubListener = new EventSubWsListener({
        apiClient: eventSubClient,
        logger: {
          minLevel: 'debug',
        },
      });

      // Start the listener before subscribing to events
      await this.eventSubListener.start();

      // Get and validate the numeric broadcaster ID
      const broadcasterId = broadcaster.id;
      logger.info('Broadcaster object:', JSON.stringify(broadcaster));
      logger.info('Raw broadcaster ID:', broadcasterId);

      if (!broadcasterId || typeof broadcasterId !== 'string') {
        throw new Error(`Invalid broadcaster ID: ${broadcasterId}`);
      }

      // Create a subscription condition
      const condition = {
        broadcasterUserId: broadcasterId,
      };

      logger.info('Setting up EventSub with condition:', JSON.stringify(condition));

      // Follow events subscription with proper condition
      this.followSubscription = await this.eventSubListener.onChannelFollow(
        condition.broadcasterUserId,
        condition.broadcasterUserId,
        async (event) => {
          // Check for suspicious follows
          const isSuspicious = await followProtection.isFollowSuspicious(event);

          // Only announce if not suspicious and not in silent mode
          if (!isSuspicious && !followProtection.isSilentMode()) {
            const response = await this.generateResponse(
              `Generate a funny thank you message for a new Twitch follower named ${event.userDisplayName}`
            );
            this.client.say(
              `#${broadcasterTokens.channel}`,
              `@${event.userDisplayName}, ${response}`
            );
          } else {
            logger.warn(
              `Suppressed follow announcement for ${event.userDisplayName} (Suspicious: ${isSuspicious}, Silent Mode: ${followProtection.isSilentMode()})`
            );
          }
        }
      );

      // Channel point redemptions subscription with proper condition
      this.redemptionSubscription = await this.eventSubListener.onChannelRedemptionAdd(
        condition.broadcasterUserId,
        condition.broadcasterUserId,
        async (event) => {
          try {
            const result = await channelPoints.handleRedemption(
              event.rewardTitle,
              event.userDisplayName,
              event.input
            );
            if (result.success) {
              this.client.say(`#${broadcasterTokens.channel}`, result.message);
            }
          } catch (error) {
            logger.error('Error handling channel point redemption:', error);
          }
        }
      );

      logger.info('EventSub listeners set up successfully');
    } catch (error) {
      logger.error('Error setting up EventSub:', error);
      // Continue even if EventSub setup fails, as chat functionality can still work
    }
  }

  async generateResponse(prompt) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a funny Twitch chat bot. Keep responses short and entertaining.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 100,
      });
      return completion.choices[0].message.content;
    } catch (error) {
      logger.error('OpenAI error:', error);
      return 'Thanks for the support!';
    }
  }

  handleError(handler) {
    return async (...args) => {
      try {
        await handler(...args);
      } catch (error) {
        const wasRefreshed = await tokenManager.handleTokenError(error);
        if (wasRefreshed) {
          // Retry the operation with new token
          try {
            await handler(...args);
          } catch (retryError) {
            logger.error('Error after token refresh:', retryError);
          }
        } else {
          logger.error('Error in event handler:', error);
        }
      }
    };
  }

  async handleTwitchError(error) {
    logger.error('Twitch client error:', error);
    await tokenManager.handleTokenError(error);
  }

  async onMessageHandler(channel, tags, message, self) {
    if (self) {
      return;
    }

    try {
      // Welcome new chatters
      if (tags['first-msg']) {
        const response = await this.generateResponse(
          'Generate a funny welcome message for a first-time chatter'
        );
        this.client.say(channel, `Welcome @${tags.username}! ${response}`);
        return;
      }

      // Check for game answers or witty responses if not a command
      if (!message.startsWith('!')) {
        // Check for game answers first
        const gameResponse = await handleGameAnswer(tags.username, message);
        if (gameResponse) {
          this.client.say(channel, gameResponse.message);
          return;
        }

        // Then check for witty responses
        const wittyResponse = await chatInteraction.getWittyResponse(message, tags.username);
        if (wittyResponse) {
          this.client.say(channel, wittyResponse);
          return;
        }
      }

      // Handle commands
      if (message.startsWith('!')) {
        const command = message.split(' ')[0].toLowerCase();
        const args = message.split(' ').slice(1);
        let response = null;

        // Get stats data outside switch to avoid lexical declarations
        const stats = analytics.getEngagementStats();
        const topChatters = stats.topChatters.slice(0, 3);
        const bestTimes = analytics.getBestStreamingTimes();

        // Check broadcaster status before switch
        const isBroadcaster = tags.badges?.broadcaster === '1';

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
            await this.handleStatsCommand(channel);
            break;

          case '!besttimes':
            await this.handleBestTimesCommand(channel);
            break;

          case '!history':
            await this.handleHistoryCommand(channel);
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
              response = await handleSongRequest(tags.username, args.join(' '), this);
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
              const target = args[0].replace('@', '');
              response = await handleRoast(this, channel, target);
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
              isBroadcaster ? 'broadcaster' : 'user'
            );
            break;

          case '!followprotection':
            if (tags.mod || isBroadcaster) {
              if (args.length === 0) {
                const config = followProtection.getConfig();
                response = {
                  success: true,
                  message: `Follow Protection Settings | Min Account Age: ${config.minAccountAge}h | Max Follows/Min: ${config.maxFollowsPerMinute} | Silent Mode Duration: ${config.silentModeDuration}m`,
                };
              } else if (args.length === 2) {
                try {
                  const [setting, value] = args;
                  followProtection.updateConfig(setting, Number(value));
                  response = {
                    success: true,
                    message: `Updated follow protection setting: ${setting} = ${value}`,
                  };
                } catch (error) {
                  response = {
                    success: false,
                    message: `Error updating setting: ${error.message}`,
                  };
                }
              } else {
                response = {
                  success: false,
                  message:
                    'Usage: !followprotection [setting] [value] - Settings: minAccountAge (hours), maxFollowsPerMinute, silentModeDuration (minutes)',
                };
              }
            } else {
              response = {
                success: false,
                message: 'This command is only available to moderators and the broadcaster',
              };
            }
            break;

          default:
            // Handle custom commands
            response = customCommands.handleCommand(command, tags.mod ? 'mod' : 'user');
            break;
        }

        if (response) {
          this.client.say(channel, response.message);
        }

        // Track analytics and game stats
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
  }

  async handleStatsCommand(channel) {
    try {
      // Remove # from channel name
      const channelName = channel.replace('#', '');
      const stream = await this.twitchApi.streams.getStreamByUserName(channelName);
      if (stream) {
        const game = await stream.getGame();
        const stats = `
          Current Stream Stats:
          - Game: ${game?.name || 'Unknown'}
          - Viewers: ${stream.viewerCount}
          - Started: ${stream.startDate.toLocaleString()}
          - Uptime: ${this.formatDuration(stream.startDate)}
        `;
        this.client.say(channel, stats);
      } else {
        this.client.say(channel, 'No active stream found');
      }
    } catch (error) {
      logger.error('Error fetching stream stats:', error);
      this.client.say(
        channel,
        'Error fetching stream stats. Make sure your Twitch API credentials are correct'
      );
    }
  }

  async updateStreamAnalytics() {
    try {
      const channelName = (await tokenManager.getBroadcasterTokens()).channel.replace('#', '');
      const stream = await this.twitchApi.streams.getStreamByUserName(channelName);
      if (stream) {
        const game = await stream.getGame();
        const gameName = game?.name || 'Unknown';

        // Update game stats
        const gameCount = this.streamAnalytics.gamesPlayed.get(gameName) || 0;
        this.streamAnalytics.gamesPlayed.set(gameName, gameCount + 1);

        // Update viewer stats
        this.streamAnalytics.averageViewers = Math.round(
          (this.streamAnalytics.averageViewers * this.streamAnalytics.totalStreams +
            stream.viewerCount) /
            (this.streamAnalytics.totalStreams + 1)
        );
        this.streamAnalytics.peakViewers = Math.max(
          this.streamAnalytics.peakViewers,
          stream.viewerCount
        );

        // Update time stats
        const hour = stream.startDate.getHours();
        const hourCount = this.streamAnalytics.bestTimes.get(hour) || 0;
        this.streamAnalytics.bestTimes.set(hour, hourCount + 1);

        // Update overall stats
        this.streamAnalytics.totalStreams++;
        this.streamAnalytics.lastStream = stream.startDate;
      }
    } catch (error) {
      logger.error('Error updating stream analytics:', error);
    }
  }

  formatDuration(startDate) {
    const diff = Date.now() - startDate.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  async handleBestTimesCommand(channel) {
    // Update analytics before showing best times
    await this.updateStreamAnalytics();
    try {
      if (this.streamAnalytics.bestTimes.size === 0) {
        this.client.say(channel, 'Not enough data to determine best times yet');
        return;
      }

      // Convert map to array and sort by count
      const sortedTimes = [...this.streamAnalytics.bestTimes.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      const bestTimes = sortedTimes
        .map(([hour, count]) => {
          const time = new Date();
          time.setHours(hour);
          return `${time.toLocaleTimeString([], { hour: '2-digit' })} (${count} streams)`;
        })
        .join(', ');

      this.client.say(channel, `Best streaming times: ${bestTimes}`);
    } catch (error) {
      logger.error('Error handling best times command:', error);
      this.client.say(channel, 'Error getting best times');
    }
  }

  async handleHistoryCommand(channel) {
    // Update analytics before showing history
    await this.updateStreamAnalytics();
    try {
      if (this.streamAnalytics.totalStreams === 0) {
        this.client.say(channel, 'No stream history available yet');
        return;
      }

      // Get most played games
      const sortedGames = [...this.streamAnalytics.gamesPlayed.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      const stats = `
        Stream History:
        - Total streams: ${this.streamAnalytics.totalStreams}
        - Average viewers: ${this.streamAnalytics.averageViewers}
        - Peak viewers: ${this.streamAnalytics.peakViewers}
        - Most played games: ${sortedGames.map(([game, count]) => `${game} (${count}x)`).join(', ')}
        - Last stream: ${this.streamAnalytics.lastStream ? this.streamAnalytics.lastStream.toLocaleDateString() : 'N/A'}
      `;

      this.client.say(channel, stats);
    } catch (error) {
      logger.error('Error handling history command:', error);
      this.client.say(channel, 'Error getting stream history');
    }
  }

  async onSubscription(channel, username, method, message, userstate) {
    const badges = userstate?.badges ? Object.keys(userstate.badges).join(', ') : 'none';
    const response = await this.generateResponse(
      `Generate a funny thank you message for a new Twitch subscriber who subscribed using ${method}${message ? ` and said: ${message}` : ''} (badges: ${badges})`
    );
    this.client.say(channel, `@${username}, ${response}`);
  }

  async onResub(channel, username, months, message, userstate, methods) {
    const badges = userstate?.badges ? Object.keys(userstate.badges).join(', ') : 'none';
    const subPlan = methods?.plan || 'unknown';
    const response = await this.generateResponse(
      `Generate a funny thank you message for someone resubscribing for ${months} months with ${subPlan} plan${message ? ` who said: ${message}` : ''} (badges: ${badges})`
    );
    this.client.say(channel, `@${username}, ${response} Thanks for ${months} amazing months!`);
  }

  async onRaid(channel, username, viewers) {
    const response = await this.generateResponse(
      `Generate a funny welcome message for a Twitch raid with ${viewers} viewers`
    );
    this.client.say(channel, `@${username} is raiding with ${viewers} viewers! ${response}`);
  }

  connect() {
    return this.client.connect();
  }
}

// Singleton instance
let instance = null;

// Export a function that returns the initialized client
export default async function getClient() {
  if (!instance) {
    instance = new TwitchClient();
    await instance.init();
    // Removed duplicate connect() call since it's already called in init()
  }
  return instance;
}
