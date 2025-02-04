import { RefreshingAuthProvider } from '@twurple/auth';
import logger from '../utils/logger.js';

class TokenManager {
  constructor() {
    this.botAuthProvider = null;
    this.broadcasterAuthProvider = null;
    this.tokenData = {
      bot: null,
      broadcaster: null,
    };
  }

  loadTokensFromEnv(type) {
    try {
      if (type === 'bot') {
        // For bot tokens, we need to ensure the access token has the oauth: prefix
        const accessToken = process.env.TWITCH_BOT_ACCESS_TOKEN;
        return {
          accessToken: accessToken.startsWith('oauth:') ? accessToken : `oauth:${accessToken}`,
          refreshToken: process.env.TWITCH_BOT_REFRESH_TOKEN,
          expiresIn: 14400,
          obtainmentTimestamp: Date.now(),
          scope: [
            'chat:read',
            'chat:edit',
            'channel:moderate',
            'whispers:read',
            'whispers:edit',
            'channel:manage:broadcast',
            'clips:edit',
          ],
        };
      } else if (type === 'broadcaster') {
        return {
          accessToken: process.env.TWITCH_ACCESS_TOKEN,
          refreshToken: process.env.TWITCH_REFRESH_TOKEN,
          expiresIn: 14400,
          obtainmentTimestamp: Date.now(),
          scope: [
            'channel:read:subscriptions',
            'channel:manage:broadcast',
            'channel:read:redemptions',
            'channel:manage:redemptions',
            'clips:edit',
            'moderation:read',
            'moderator:manage:banned_users',
            'moderator:manage:chat_messages',
            'channel:moderate',
          ],
        };
      }
      return null;
    } catch (error) {
      logger.error(`Error loading ${type} tokens:`, error);
      return null;
    }
  }

  async initializeAuthProviders() {
    try {
      // Load bot tokens
      this.tokenData.bot = this.loadTokensFromEnv('bot');
      if (!this.tokenData.bot?.accessToken || !this.tokenData.bot?.refreshToken) {
        throw new Error('Bot tokens not found in environment variables');
      }

      // Load broadcaster tokens
      this.tokenData.broadcaster = this.loadTokensFromEnv('broadcaster');
      if (!this.tokenData.broadcaster?.accessToken || !this.tokenData.broadcaster?.refreshToken) {
        throw new Error('Broadcaster tokens not found in environment variables');
      }

      // Initialize bot auth provider
      this.botAuthProvider = new RefreshingAuthProvider(
        {
          clientId: process.env.TWITCH_BOT_CLIENT_ID,
          clientSecret: process.env.TWITCH_BOT_CLIENT_SECRET,
          onRefresh: async (userId, newTokenData) => {
            this.tokenData.bot = {
              ...this.tokenData.bot,
              ...newTokenData,
            };
            logger.info('Bot tokens refreshed');
          },
        },
        this.tokenData.bot
      );

      // Initialize broadcaster auth provider
      this.broadcasterAuthProvider = new RefreshingAuthProvider(
        {
          clientId: process.env.TWITCH_CLIENT_ID,
          clientSecret: process.env.TWITCH_CLIENT_SECRET,
          onRefresh: async (userId, newTokenData) => {
            this.tokenData.broadcaster = {
              ...this.tokenData.broadcaster,
              ...newTokenData,
            };
            logger.info('Broadcaster tokens refreshed');
          },
        },
        this.tokenData.broadcaster
      );

      logger.info('Auth providers initialized successfully');
    } catch (error) {
      logger.error('Error initializing auth providers:', error);
      throw error;
    }
  }

  async getAuthProviders() {
    if (!this.botAuthProvider || !this.broadcasterAuthProvider) {
      await this.initializeAuthProviders();
    }
    return {
      botAuthProvider: this.botAuthProvider,
      broadcasterAuthProvider: this.broadcasterAuthProvider,
    };
  }

  async refreshTokens() {
    try {
      // Refresh bot tokens
      if (this.botAuthProvider) {
        await this.botAuthProvider.refresh();
        logger.info('Bot tokens refreshed');
      }

      // Refresh broadcaster tokens
      if (this.broadcasterAuthProvider) {
        await this.broadcasterAuthProvider.refresh();
        logger.info('Broadcaster tokens refreshed');
      }
    } catch (error) {
      logger.error('Error refreshing tokens:', error);
      throw error;
    }
  }

  async validateTokens() {
    try {
      const now = Date.now();
      let needsRefresh = false;

      // Check bot tokens
      if (
        this.tokenData.bot &&
        now - this.tokenData.bot.obtainmentTimestamp > this.tokenData.bot.expiresIn * 1000
      ) {
        needsRefresh = true;
      }

      // Check broadcaster tokens
      if (
        this.tokenData.broadcaster &&
        now - this.tokenData.broadcaster.obtainmentTimestamp >
          this.tokenData.broadcaster.expiresIn * 1000
      ) {
        needsRefresh = true;
      }

      if (needsRefresh) {
        await this.refreshTokens();
      }

      return true;
    } catch (error) {
      logger.error('Error validating tokens:', error);
      return false;
    }
  }
}

const tokenManager = new TokenManager();
export default tokenManager;
