import { ApiClient } from '@twurple/api';
import { handleShoutout } from './commands/shoutout.js';
import { ChatClient } from '@twurple/chat';
import { RefreshingAuthProvider } from '@twurple/auth';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import logger from '../utils/logger.js';
import updateEnvFile from './updateEnvFile.js';
import welcomeManager from './welcomeManager.js';

class TwitchClient {
  constructor() {
    this.client = null;
    this.apiClient = null;
    this.eventSub = null;
    this.isReady = false;
    this.messageHandler = null;
    this.userId = null;
    this.channelId = null;
    this.channel = null;
    this.broadcasterUser = null;
    this.followCooldowns = new Map();
    this.FOLLOW_COOLDOWN = 5000; // 5 seconds in milliseconds

    // Common bot identifiers
    this.botPatterns = [
      /bot$/i,
      /[._-]bot/i,
      /nightbot/i,
      /streamelements/i,
      /streamlabs/i,
      /commanderroot/i,
      /lurxx/i,
      /v_and_k/i,
      /0_0[._-]?bot/i,
      /stay_hydrated/i,
      /sery_bot/i,
      /wizebot/i,
      /moobot/i,
      /fossabot/i,
      /^soundalerts/i,
      /^anotherttvviewer/i,
      /^streamholics/i,
      /^electricalskateboard/i,
      /^discord[._-]?bot/i,
      /^own3d[._-]?bot/i,
      /^pretzel[._-]?rocks/i,
      /^restream[._-]?bot/i,
      /^botrix/i,
      /^streamcapbot/i,
      /^pokeinfobot/i,
      /^pokemoncommunitygame/i,
      /^sery_bot/i,
    ];
  }

  isBot(username) {
    return this.botPatterns.some((pattern) => pattern.test(username.toLowerCase()));
  }

  isOnFollowCooldown(username) {
    const lastGreeting = this.followCooldowns.get(username);
    return lastGreeting && Date.now() - lastGreeting < this.FOLLOW_COOLDOWN;
  }

  setFollowCooldown(username) {
    this.followCooldowns.set(username, Date.now());
    // Clean up old cooldowns after 1 minute
    setTimeout(() => this.followCooldowns.delete(username), 60000);
  }

  setMessageHandler(handler) {
    logger.debug('Setting message handler');
    this.messageHandler = handler;
    if (this.client && this.isReady) {
      this.setupMessageHandler();
    }
  }

  setupMessageHandler() {
    if (!this.messageHandler) {
      logger.warn('No message handler to setup');
      return;
    }

    logger.debug('Setting up message handler...');

    // Register handler
    this.client.onMessage((channel, user, text, msg) => {
      logger.debug('Message received:', {
        channel,
        username: user.username,
        text,
        msgType: msg.userInfo.messageType,
      });

      // Skip bot messages
      if (this.isBot(user.username)) {
        logger.debug(`Message from ${user.username} skipped (bot detected)`);
        return;
      }

      // Skip self messages
      if (msg.userInfo.isSelf) {
        logger.debug('Ignoring self message');
        return;
      }

      // Process all messages from broadcaster
      logger.debug('Processing message from broadcaster');

      this.messageHandler(channel, user, text, false);
    });

    logger.debug('Message handler registered successfully');
  }

  async init() {
    try {
      logger.info('Initializing Twitch client...');
      const config = {
        clientId: process.env.TWITCH_BOT_CLIENT_ID,
        clientSecret: process.env.TWITCH_BOT_CLIENT_SECRET,
        accessToken: process.env.TWITCH_BOT_ACCESS_TOKEN,
        refreshToken: process.env.TWITCH_BOT_REFRESH_TOKEN,
        channel: `#${(process.env.TWITCH_CHANNEL || 'pyro1121').toLowerCase()}`,
        botUsername: process.env.BOT_USERNAME || 'FirePigBot',
      };

      logger.debug('Config:', {
        ...config,
        clientId: '***',
        clientSecret: '***',
        accessToken: '***',
        refreshToken: '***',
      });

      const missingValues = Object.entries(config)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

      if (missingValues.length > 0) {
        throw new Error(`Missing required configuration: ${missingValues.join(', ')}`);
      }

      logger.info('Configuration validated');
      logger.info(`Bot username: ${config.botUsername}`);
      logger.info(`Target channel: ${config.channel}`);

      const authProvider = new RefreshingAuthProvider({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        onRefresh: async (userId, newTokenData) => {
          logger.info('Tokens refreshed');
          // Implement token storage logic here if needed
        },
      });

      await authProvider.addUserForToken(
        {
          accessToken: config.accessToken,
          refreshToken: config.refreshToken,
          expiresIn: 0,
          obtainmentTimestamp: 0,
          scope: [
            'chat:read',
            'chat:edit',
            'channel:moderate',
            'whispers:read',
            'whispers:edit',
            'channel:bot',
            'channel:read:stream_key',
            'channel:read:subscriptions',
            'channel:manage:broadcast',
            'moderator:read:followers',
            'moderator:manage:banned_users',
            'moderator:manage:chat_messages',
            'channel:read:follows',
            'moderator:read:followers',
            'channel:manage:moderators',
            'channel:read:vips',
            'channel:manage:vips',
            'channel:read:raids',
            'channel:manage:raids',
          ],
        },
        ['chat', 'whispers', 'moderator']
      );

      // Initialize API client with full capabilities
      this.apiClient = new ApiClient({
        authProvider,
        logger: { minLevel: 'info' },
      });

      // Test API client initialization
      try {
        const channelName = config.channel.replace('#', '');
        logger.debug('Looking up channel:', { channelName });

        const user = await this.apiClient.users.getUserByName(channelName);
        if (!user) {
          throw new Error(`Channel ${channelName} not found`);
        }

        logger.debug('API client test successful:', {
          id: user.id,
          name: user.name,
          displayName: user.displayName,
        });

        // Store channel info for future use
        this.channelId = user.id;
        this.userId = user.id;
        this.channel = channelName;

        // Initialize EventSub with broadcaster token
        const broadcasterAuthProvider = new RefreshingAuthProvider({
          clientId: process.env.TWITCH_CLIENT_ID,
          clientSecret: process.env.TWITCH_CLIENT_SECRET,
          onRefresh: async (userId, newTokenData) => {
            logger.info('Broadcaster tokens refreshed');
          },
        });

        await broadcasterAuthProvider.addUserForToken(
          {
            accessToken: process.env.TWITCH_ACCESS_TOKEN,
            refreshToken: process.env.TWITCH_REFRESH_TOKEN,
            expiresIn: 0,
            obtainmentTimestamp: 0,
            scope: [
              'channel:read:subscriptions',
              'channel:manage:broadcast',
              'channel:read:follows',
              'channel:manage:moderators',
              'channel:read:vips',
              'channel:manage:vips',
              'moderator:read:followers',
              'channel:read:subscriptions',
              'channel:read:redemptions',
              'channel:read:polls',
              'channel:read:predictions',
            ],
          },
          ['chat']
        );

        const broadcasterApiClient = new ApiClient({
          authProvider: broadcasterAuthProvider,
          logger: { minLevel: 'info' },
        });

        // Test broadcaster API client
        this.broadcasterUser = await broadcasterApiClient.users.getUserByName(this.channel);
        if (!this.broadcasterUser) {
          throw new Error('Failed to verify broadcaster API client');
        }
        logger.debug('Broadcaster API client verified:', {
          id: this.broadcasterUser.id,
          name: this.broadcasterUser.name,
        });

        this.eventSub = new EventSubWsListener({
          apiClient: broadcasterApiClient,
        });
        await this.eventSub.start();
        logger.debug('EventSub listener started with broadcaster token');
      } catch (error) {
        logger.error('API client test failed:', error);
        throw new Error('Failed to verify API client functionality');
      }

      this.client = new ChatClient({
        authProvider,
        channels: [config.channel],
        logger: { minLevel: 'info' },
        isAlwaysMod: true,
        botLevel: 'known',
      });

      logger.info('Connecting to Twitch chat...');
      try {
        await this.client.connect();
        this.isReady = true;
        logger.info('Successfully connected to chat');
      } catch (error) {
        logger.error('Failed to connect to Twitch chat:', error);
        throw error;
      }

      this.setupEventHandlers();
      await this.client.say(config.channel, '🤖 Bot initialized and ready!');
      return this;
    } catch (error) {
      logger.error('Error initializing Twitch client:', error);
      throw error;
    }
  }

  setupEventHandlers() {
    // Setup message handler if one exists
    if (this.messageHandler) {
      this.setupMessageHandler();
    }

    // Setup EventSub handlers if available
    if (this.eventSub) {
      // Follow events
      this.eventSub.onChannelFollow(
        this.broadcasterUser.id,
        this.broadcasterUser.id,
        async (follow) => {
          const username = follow.userDisplayName;
          logger.info(`New follower: ${username}`);

          // Skip bots and broadcaster
          if (this.isBot(username) || username.toLowerCase() === this.channel.toLowerCase()) {
            logger.debug(
              `Follow greeting for ${username} skipped (${this.isBot(username) ? 'bot detected' : 'broadcaster'})`
            );
            return;
          }

          // Check cooldown
          if (this.isOnFollowCooldown(username)) {
            logger.debug(`Follow greeting for ${username} skipped (cooldown)`);
            return;
          }

          try {
            // Get personalized follow message from welcomeManager
            const followMessage = await welcomeManager.handleFollow(username);
            if (followMessage) {
              await this.client.say(`#${this.channel}`, followMessage);
            } else {
              // Fallback message if welcomeManager fails
              await this.client.say(
                `#${this.channel}`,
                `Welcome to the channel ${username}! Thanks for the follow! 🎉`
              );
            }
            // Set cooldown after successful greeting
            this.setFollowCooldown(username);
          } catch (error) {
            logger.error('Error handling follow event:', error);
            // Send basic follow message as fallback
            await this.client.say(
              `#${this.channel}`,
              `Welcome to the channel ${username}! Thanks for the follow! 🎉`
            );
            // Still set cooldown even if there was an error
            this.setFollowCooldown(username);
          }
        }
      );
    }

    // Sub events
    this.client.on('sub', (channel, user, subInfo, msg) => {
      // logger.info(`${user} subscribed to ${channel}`);
    });

    this.client.on('resub', (channel, user, subInfo, msg) => {
      // logger.info(`${user} resubscribed to ${channel} for ${subInfo.months} months`);
    });

    // Bits events
    this.client.on('bitsBadgeUpgrade', (channel, user, upgradeInfo, msg) => {
      logger.info(`${user} upgraded their bits badge in ${channel}`);
    });

    // Raid events
    this.client.onRaid(async (channel, username, { viewerCount }) => {
      const channelName = channel.replace('#', '');
      logger.info(`${username} raided ${channelName} with ${viewerCount} viewers`);

      try {
        // Import the shoutout handler dynamically to avoid circular dependencies
        const { handleShoutout } = await import('./commands/shoutout.js');

        const shoutoutResponse = await handleShoutout(
          this, // Pass the TwitchClient instance
          `#${channelName}`,
          { username, isMod: true }, // Treat raid shoutouts as if from a mod
          [username]
        );

        if (shoutoutResponse) {
          await this.client.say(
            `#${channelName}`,
            `Thanks for the raid with ${viewerCount} viewers! ${shoutoutResponse}`
          );
        }
      } catch (error) {
        logger.error('Error handling raid shoutout:', error);
        // Fallback message if shoutout fails
        await this.client.say(
          `#${channelName}`,
          `Thanks for the raid with ${viewerCount} viewers, @${username}! 🎉`
        );
      }
    });

    // Timeout/Ban events
    this.client.on('timeout', (channel, user, duration, msg) => {
      logger.info(`${user} was timed out in ${channel} for ${duration} seconds`);
    });

    this.client.on('ban', (channel, user, msg) => {
      logger.info(`${user} was banned in ${channel}`);
    });

    // Disconnection handling
    this.client.on('disconnect', (manually, reason) => {
      logger.warn(`Disconnected from Twitch chat: ${reason}`);
      this.isReady = false;
      if (!manually) {
        this.handleReconnect();
      }
    });
  }

  async handleReconnect(retryCount = 0, maxRetries = 10) {
    if (retryCount >= maxRetries) {
      logger.error('Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(2000 * Math.pow(2, retryCount), 30000);
    logger.info(
      `Attempting to reconnect in ${delay / 1000} seconds... (Attempt ${retryCount + 1}/${maxRetries})`
    );
    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await this.client.connect(); logger.info('Successfully reconnected to Twitch chat');
      logger.info('Successfully reconnected to Twitch chat');
    } catch (error) {
      logger.error(`Reconnection attempt ${retryCount + 1} failed: ${error.message} ${error.stack}`);
      await this.handleReconnect(retryCount + 1, maxRetries);
    }
  }
}

async function getClient() {
  logger.info('Creating new Twitch client instance...');
  const client = new TwitchClient();
  return client.init();
}

export default getClient;
