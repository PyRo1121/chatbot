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

  async refreshToken() {
    // Prevent multiple rapid refresh attempts
    if (Date.now() - this.lastRefresh < this.REFRESH_COOLDOWN) {
      logger.debug('Token refresh attempted too soon after previous attempt');
      return false;
    }

    this.lastRefresh = Date.now();
    logger.info('Refreshing Twitch token...');

    try {
      const response = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.TWITCH_BOT_CLIENT_ID,
          client_secret: process.env.TWITCH_BOT_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: process.env.TWITCH_BOT_REFRESH_TOKEN,
        }),
      });

      const data = await response.json();

      if (!data.access_token) {
        throw new Error(`No access token in response: ${JSON.stringify(data)}`);
      }

      // Update environment variables in memory
      process.env.TWITCH_BOT_ACCESS_TOKEN = data.access_token;
      process.env.TWITCH_OAUTH_TOKEN = `oauth:${data.access_token}`;
      if (data.refresh_token) {
        process.env.TWITCH_BOT_REFRESH_TOKEN = data.refresh_token;
      }

      // Update .env file
      await this.updateEnvFile({
        TWITCH_BOT_ACCESS_TOKEN: data.access_token,
        TWITCH_OAUTH_TOKEN: `oauth:${data.access_token}`,
        ...(data.refresh_token && { TWITCH_BOT_REFRESH_TOKEN: data.refresh_token }),
      });

      logger.info('Successfully refreshed Twitch token');
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

  handleTokenError(error) {
    // Check if error is due to invalid token
    const isAuthError =
      error.message?.includes('invalid token') ||
      error.message?.includes('token expired') ||
      error.message?.includes('unauthorized') ||
      error.status === 401;

    if (isAuthError) {
      logger.info('Token appears to be invalid, attempting refresh...');
      return this.refreshToken();
    }

    return false;
  }
}

const tokenManager = new TokenManager();
export default tokenManager;
