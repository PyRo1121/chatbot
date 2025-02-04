import SpotifyWebApi from 'spotify-web-api-node';
import logger from '../utils/logger.js';
import 'dotenv/config';

class SpotifyAuth {
  constructor() {
    if (
      !process.env.SPOTIFY_CLIENT_ID ||
      !process.env.SPOTIFY_CLIENT_SECRET ||
      !process.env.SPOTIFY_REDIRECT_URI
    ) {
      throw new Error('Missing required Spotify environment variables');
    }

    this.spotifyApi = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      redirectUri: process.env.SPOTIFY_REDIRECT_URI,
    });

    this.tokenInfo = null;
    this.tokenRefreshInterval = null;
    this.refreshThreshold = 5 * 60 * 1000; // 5 minutes in milliseconds
  }

  async initialize() {
    try {
      if (!process.env.SPOTIFY_REFRESH_TOKEN) {
        throw new Error('SPOTIFY_REFRESH_TOKEN environment variable is required');
      }

      this.spotifyApi.setRefreshToken(process.env.SPOTIFY_REFRESH_TOKEN);
      await this.refreshAccessToken();

      // Set up automatic token refresh
      this.tokenRefreshInterval = setInterval(
        async () => {
          try {
            await this.refreshAccessToken();
          } catch (error) {
            logger.error('Failed to refresh Spotify token:', error);
            // Attempt to recover by reinitializing
            try {
              await this.initialize();
            } catch (initError) {
              logger.error('Failed to reinitialize Spotify auth:', initError);
            }
          }
        },
        45 * 60 * 1000
      ); // Refresh every 45 minutes

      logger.info('Spotify authentication initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Spotify authentication:', error);
      throw error;
    }
  }

  async refreshAccessToken() {
    try {
      const data = await this.spotifyApi.refreshAccessToken();

      this.tokenInfo = {
        accessToken: data.body.access_token,
        expiresIn: data.body.expires_in,
        timestamp: Date.now(),
      };

      this.spotifyApi.setAccessToken(this.tokenInfo.accessToken);

      logger.debug('Spotify access token refreshed successfully', {
        expiresIn: this.tokenInfo.expiresIn,
      });

      return this.tokenInfo;
    } catch (error) {
      logger.error('Error refreshing access token:', error);
      throw error;
    }
  }

  async getValidApi() {
    try {
      if (!this.tokenInfo) {
        await this.refreshAccessToken();
      } else {
        const expirationTime = this.tokenInfo.timestamp + this.tokenInfo.expiresIn * 1000;
        const currentTime = Date.now();

        if (currentTime >= expirationTime - this.refreshThreshold) {
          await this.refreshAccessToken();
        }
      }

      return this.spotifyApi;
    } catch (error) {
      logger.error('Error getting valid Spotify API:', error);
      throw error;
    }
  }

  async retryOperation(operation, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const api = await this.getValidApi();
        return await operation(api);
      } catch (error) {
        if (error.statusCode === 401) {
          await this.refreshAccessToken();
        } else if (attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  cleanup() {
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }
  }
}

const spotifyAuth = new SpotifyAuth();
export default spotifyAuth;
