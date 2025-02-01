<<<<<<< HEAD
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import logger from '../utils/logger.js';

class TokenManager {
  constructor() {
    this.envPath = path.join(process.cwd(), '.env');
    this.lastRefresh = 0;
    this.REFRESH_COOLDOWN = 60 * 1000; // 1 minute cooldown between refresh attempts
  }

  async refreshToken(type = 'bot') {
    // Prevent multiple rapid refresh attempts
    if (Date.now() - this.lastRefresh < this.REFRESH_COOLDOWN) {
      logger.debug('Token refresh attempted too soon after previous attempt');
      return false;
    }

    this.lastRefresh = Date.now();
    logger.info(`Refreshing ${type} Twitch token...`);

    const config =
      type === 'broadcaster'
        ? {
            clientId: process.env.TWITCH_CLIENT_ID,
            clientSecret: process.env.TWITCH_CLIENT_SECRET,
            refreshToken: process.env.TWITCH_REFRESH_TOKEN,
            accessTokenEnvKey: 'TWITCH_ACCESS_TOKEN',
            refreshTokenEnvKey: 'TWITCH_REFRESH_TOKEN',
          }
        : {
            clientId: process.env.TWITCH_BOT_CLIENT_ID,
            clientSecret: process.env.TWITCH_BOT_CLIENT_SECRET,
            refreshToken: process.env.TWITCH_BOT_REFRESH_TOKEN,
            accessTokenEnvKey: 'TWITCH_BOT_ACCESS_TOKEN',
            refreshTokenEnvKey: 'TWITCH_BOT_REFRESH_TOKEN',
          };

    try {
      const response = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: config.refreshToken,
        }),
      });

      const data = await response.json();

      if (!data.access_token) {
        throw new Error(`No access token in response: ${JSON.stringify(data)}`);
      }

      // Update environment variables in memory
      process.env[config.accessTokenEnvKey] = data.access_token;
      if (type === 'bot') {
        process.env.TWITCH_OAUTH_TOKEN = `oauth:${data.access_token}`;
      }
      if (data.refresh_token) {
        process.env[config.refreshTokenEnvKey] = data.refresh_token;
      }

      // Update .env file
      const updates = {
        [config.accessTokenEnvKey]: data.access_token,
        ...(type === 'bot' && { TWITCH_OAUTH_TOKEN: `oauth:${data.access_token}` }),
        ...(data.refresh_token && { [config.refreshTokenEnvKey]: data.refresh_token }),
      };
      await this.updateEnvFile(updates);

      logger.info(`Successfully refreshed ${type} Twitch token`);
      return true;
    } catch (error) {
      logger.error('Error refreshing token:', error);
      return false;
    }
  }

  async updateEnvFile(newValues) {
    try {
      // Read current .env content
      const envContent = await fs.readFile(this.envPath, 'utf8');
      const envLines = envContent.split('\n');

      // Update values
      const updatedLines = envLines.map((line) => {
        const [key] = line.split('=');
        if (key && newValues[key.trim()]) {
          return `${key}=${newValues[key.trim()]}`;
        }
        return line;
      });

      // Write back to file
      await fs.writeFile(this.envPath, updatedLines.join('\n'));
      logger.info('Updated .env file with new token values');
    } catch (error) {
      logger.error('Error updating .env file:', error);
      throw error;
    }
  }

  getBotTokens() {
    return {
      clientId: process.env.TWITCH_BOT_CLIENT_ID,
      clientSecret: process.env.TWITCH_BOT_CLIENT_SECRET,
      accessToken: process.env.TWITCH_BOT_ACCESS_TOKEN,
      refreshToken: process.env.TWITCH_BOT_REFRESH_TOKEN,
      username: process.env.TWITCH_BOT_USERNAME,
    };
  }

  getBroadcasterTokens() {
    return {
      clientId: process.env.TWITCH_CLIENT_ID,
      clientSecret: process.env.TWITCH_CLIENT_SECRET,
      accessToken: process.env.TWITCH_ACCESS_TOKEN,
      refreshToken: process.env.TWITCH_REFRESH_TOKEN,
      userId: process.env.TWITCH_USER_ID,
      channel: process.env.TWITCH_CHANNEL,
    };
  }

  async updateBotTokens(newTokenData) {
    const updates = {
      TWITCH_BOT_ACCESS_TOKEN: newTokenData.accessToken,
      TWITCH_OAUTH_TOKEN: `oauth:${newTokenData.accessToken}`,
      ...(newTokenData.refreshToken && {
        TWITCH_BOT_REFRESH_TOKEN: newTokenData.refreshToken,
      }),
    };

    // Update environment variables in memory
    process.env.TWITCH_BOT_ACCESS_TOKEN = newTokenData.accessToken;
    process.env.TWITCH_OAUTH_TOKEN = `oauth:${newTokenData.accessToken}`;
    if (newTokenData.refreshToken) {
      process.env.TWITCH_BOT_REFRESH_TOKEN = newTokenData.refreshToken;
    }

    // Update .env file
    await this.updateEnvFile(updates);
    logger.info('Bot tokens updated successfully');
  }

  async updateBroadcasterTokens(newTokenData) {
    const updates = {
      TWITCH_ACCESS_TOKEN: newTokenData.accessToken,
      ...(newTokenData.refreshToken && {
        TWITCH_REFRESH_TOKEN: newTokenData.refreshToken,
      }),
    };

    // Update environment variables in memory
    process.env.TWITCH_ACCESS_TOKEN = newTokenData.accessToken;
    if (newTokenData.refreshToken) {
      process.env.TWITCH_REFRESH_TOKEN = newTokenData.refreshToken;
    }

    // Update .env file
    await this.updateEnvFile(updates);
    logger.info('Broadcaster tokens updated successfully');
  }

  handleTokenError(error) {
    // Check if error is due to invalid token
    const isAuthError =
      error.message?.includes('invalid token') ||
      error.message?.includes('token expired') ||
      error.message?.includes('unauthorized') ||
      error.status === 401;

    if (isAuthError) {
      // Determine if it's a broadcaster token error
      const isBroadcasterError =
        error.message?.includes('broadcaster') ||
        error.message?.includes('channel:read:subscriptions') ||
        error.message?.includes('moderator:read:followers');

      logger.info(
        `${isBroadcasterError ? 'Broadcaster' : 'Bot'} token appears to be invalid, attempting refresh...`
      );
      return this.refreshToken(isBroadcasterError ? 'broadcaster' : 'bot');
    }

    return false;
  }
}

const tokenManager = new TokenManager();
export default tokenManager;
=======
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import logger from '../utils/logger.js';

class TokenManager {
  constructor() {
    this.envPath = path.join(process.cwd(), '.env');
    this.lastRefresh = 0;
    this.REFRESH_COOLDOWN = 60 * 1000; // 1 minute cooldown between refresh attempts
  }

  async refreshToken(type = 'bot') {
    // Prevent multiple rapid refresh attempts
    if (Date.now() - this.lastRefresh < this.REFRESH_COOLDOWN) {
      logger.debug('Token refresh attempted too soon after previous attempt');
      return false;
    }

    this.lastRefresh = Date.now();
    logger.info(`Refreshing ${type} Twitch token...`);

    const config =
      type === 'broadcaster'
        ? {
            clientId: process.env.TWITCH_CLIENT_ID,
            clientSecret: process.env.TWITCH_CLIENT_SECRET,
            refreshToken: process.env.TWITCH_REFRESH_TOKEN,
            accessTokenEnvKey: 'TWITCH_ACCESS_TOKEN',
            refreshTokenEnvKey: 'TWITCH_REFRESH_TOKEN',
          }
        : {
            clientId: process.env.TWITCH_BOT_CLIENT_ID,
            clientSecret: process.env.TWITCH_BOT_CLIENT_SECRET,
            refreshToken: process.env.TWITCH_BOT_REFRESH_TOKEN,
            accessTokenEnvKey: 'TWITCH_BOT_ACCESS_TOKEN',
            refreshTokenEnvKey: 'TWITCH_BOT_REFRESH_TOKEN',
          };

    try {
      const response = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: config.refreshToken,
        }),
      });

      const data = await response.json();

      if (!data.access_token) {
        throw new Error(`No access token in response: ${JSON.stringify(data)}`);
      }

      // Update environment variables in memory
      process.env[config.accessTokenEnvKey] = data.access_token;
      if (type === 'bot') {
        process.env.TWITCH_OAUTH_TOKEN = `oauth:${data.access_token}`;
      }
      if (data.refresh_token) {
        process.env[config.refreshTokenEnvKey] = data.refresh_token;
      }

      // Update .env file
      const updates = {
        [config.accessTokenEnvKey]: data.access_token,
        ...(type === 'bot' && { TWITCH_OAUTH_TOKEN: `oauth:${data.access_token}` }),
        ...(data.refresh_token && { [config.refreshTokenEnvKey]: data.refresh_token }),
      };
      await this.updateEnvFile(updates);

      logger.info(`Successfully refreshed ${type} Twitch token`);
      return true;
    } catch (error) {
      logger.error('Error refreshing token:', error);
      return false;
    }
  }

  async updateEnvFile(newValues) {
    try {
      // Read current .env content
      const envContent = await fs.readFile(this.envPath, 'utf8');
      const envLines = envContent.split('\n');

      // Update values
      const updatedLines = envLines.map((line) => {
        const [key] = line.split('=');
        if (key && newValues[key.trim()]) {
          return `${key}=${newValues[key.trim()]}`;
        }
        return line;
      });

      // Write back to file
      await fs.writeFile(this.envPath, updatedLines.join('\n'));
      logger.info('Updated .env file with new token values');
    } catch (error) {
      logger.error('Error updating .env file:', error);
      throw error;
    }
  }

  getBotTokens() {
    return {
      clientId: process.env.TWITCH_BOT_CLIENT_ID,
      clientSecret: process.env.TWITCH_BOT_CLIENT_SECRET,
      accessToken: process.env.TWITCH_BOT_ACCESS_TOKEN,
      refreshToken: process.env.TWITCH_BOT_REFRESH_TOKEN,
      username: process.env.TWITCH_BOT_USERNAME,
    };
  }

  getBroadcasterTokens() {
    return {
      clientId: process.env.TWITCH_CLIENT_ID,
      clientSecret: process.env.TWITCH_CLIENT_SECRET,
      accessToken: process.env.TWITCH_ACCESS_TOKEN,
      refreshToken: process.env.TWITCH_REFRESH_TOKEN,
      userId: process.env.TWITCH_USER_ID,
      channel: process.env.TWITCH_CHANNEL,
    };
  }

  async updateBotTokens(newTokenData) {
    const updates = {
      TWITCH_BOT_ACCESS_TOKEN: newTokenData.accessToken,
      TWITCH_OAUTH_TOKEN: `oauth:${newTokenData.accessToken}`,
      ...(newTokenData.refreshToken && {
        TWITCH_BOT_REFRESH_TOKEN: newTokenData.refreshToken,
      }),
    };

    // Update environment variables in memory
    process.env.TWITCH_BOT_ACCESS_TOKEN = newTokenData.accessToken;
    process.env.TWITCH_OAUTH_TOKEN = `oauth:${newTokenData.accessToken}`;
    if (newTokenData.refreshToken) {
      process.env.TWITCH_BOT_REFRESH_TOKEN = newTokenData.refreshToken;
    }

    // Update .env file
    await this.updateEnvFile(updates);
    logger.info('Bot tokens updated successfully');
  }

  async updateBroadcasterTokens(newTokenData) {
    const updates = {
      TWITCH_ACCESS_TOKEN: newTokenData.accessToken,
      ...(newTokenData.refreshToken && {
        TWITCH_REFRESH_TOKEN: newTokenData.refreshToken,
      }),
    };

    // Update environment variables in memory
    process.env.TWITCH_ACCESS_TOKEN = newTokenData.accessToken;
    if (newTokenData.refreshToken) {
      process.env.TWITCH_REFRESH_TOKEN = newTokenData.refreshToken;
    }

    // Update .env file
    await this.updateEnvFile(updates);
    logger.info('Broadcaster tokens updated successfully');
  }

  handleTokenError(error) {
    // Check if error is due to invalid token
    const isAuthError =
      error.message?.includes('invalid token') ||
      error.message?.includes('token expired') ||
      error.message?.includes('unauthorized') ||
      error.status === 401;

    if (isAuthError) {
      // Determine if it's a broadcaster token error
      const isBroadcasterError =
        error.message?.includes('broadcaster') ||
        error.message?.includes('channel:read:subscriptions') ||
        error.message?.includes('moderator:read:followers');

      logger.info(
        `${isBroadcasterError ? 'Broadcaster' : 'Bot'} token appears to be invalid, attempting refresh...`
      );
      return this.refreshToken(isBroadcasterError ? 'broadcaster' : 'bot');
    }

    return false;
  }
}

const tokenManager = new TokenManager();
export default tokenManager;
>>>>>>> origin/master
