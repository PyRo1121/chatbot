import { ApiClient } from '@twurple/api';
import { ChatClient } from '@twurple/chat';
import { RefreshingAuthProvider } from '@twurple/auth';
import logger from '../utils/logger.js';

class TwitchClient {
  constructor() {
    this.client = null;
    this.apiClient = null;
    this.isReady = false;
    this.messageHandler = null;
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
      this.messageHandler(channel, user, text, msg.userInfo.isSelf);
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
        throw new Error(
          `Missing required configuration: ${missingValues.join(', ')}`
        );
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
          ],
        },
        ['chat', 'whispers', 'moderator']
      );

      // Initialize API client with full capabilities
      this.apiClient = new ApiClient({
        authProvider,
        logger: { minLevel: 'debug' },
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

        // Store channel ID for future use
        this.channelId = user.id;
      } catch (error) {
        logger.error('API client test failed:', error);
        throw new Error('Failed to verify API client functionality');
      }

      this.client = new ChatClient({
        authProvider,
        channels: [config.channel],
        logger: { minLevel: 'debug' },
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

    // Sub events
    this.client.on('sub', (channel, user, subInfo, msg) => {
      logger.info(`${user} subscribed to ${channel}`);
    });

    this.client.on('resub', (channel, user, subInfo, msg) => {
      logger.info(
        `${user} resubscribed to ${channel} for ${subInfo.months} months`
      );
    });

    // Bits events
    this.client.on('bitsBadgeUpgrade', (channel, user, upgradeInfo, msg) => {
      logger.info(`${user} upgraded their bits badge in ${channel}`);
    });

    // Raid events
    this.client.on('raid', (channel, user, raidInfo, msg) => {
      logger.info(
        `${user} raided ${channel} with ${raidInfo.viewerCount} viewers`
      );
    });

    // Timeout/Ban events
    this.client.on('timeout', (channel, user, duration, msg) => {
      logger.info(
        `${user} was timed out in ${channel} for ${duration} seconds`
      );
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

  async handleReconnect(retryCount = 0, maxRetries = 5) {
    if (retryCount >= maxRetries) {
      logger.error('Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
    logger.info(
      `Attempting to reconnect in ${delay / 1000} seconds... (Attempt ${retryCount + 1}/${maxRetries})`
    );
    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await this.client.connect();
      logger.info('Successfully reconnected to Twitch chat');
    } catch (error) {
      logger.error(`Reconnection attempt ${retryCount + 1} failed:`, error);
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
