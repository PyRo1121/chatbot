import { generateResponse } from '../utils/gemini.js';
import logger from '../utils/logger.js';
import viewerManager from './viewerManager.js';
import { ApiClient } from '@twurple/api';
import { RefreshingAuthProvider } from '@twurple/auth';

class WelcomeManager {
  constructor() {
    this.recentFollows = new Set();
    this.welcomeMessageCooldown = new Map();
    this.COOLDOWN_DURATION = 30 * 60 * 1000; // 30 minutes
    this.apiClient = null;
    this.streamGreetings = new Set(); // Track greetings for current stream
    this.initializeApiClient();
  }

  clearStreamMemory() {
    // Call this when stream starts/ends
    this.streamGreetings.clear();
    logger.info('Cleared stream greetings memory');
  }

  async initializeApiClient() {
    try {
      const authProvider = new RefreshingAuthProvider({
        clientId: process.env.TWITCH_BOT_CLIENT_ID,
        clientSecret: process.env.TWITCH_BOT_CLIENT_SECRET,
      });

      await authProvider.addUserForToken({
        accessToken: process.env.TWITCH_BOT_ACCESS_TOKEN,
        refreshToken: process.env.TWITCH_BOT_REFRESH_TOKEN,
        expiresIn: 0,
        obtainmentTimestamp: 0,
        scope: ['user:read:email'],
      });

      this.apiClient = new ApiClient({ authProvider });
      logger.debug('Twitch API client initialized for welcomeManager');
    } catch (error) {
      logger.error('Failed to initialize Twitch API client:', error);
    }
  }

  async getUserInfo(username) {
    try {
      if (!this.apiClient) {
        await this.initializeApiClient();
      }

      const user = await this.apiClient.users.getUserByName(username);
      if (!user) {
        return null;
      }

      return {
        displayName: user.displayName,
        description: user.description,
        profilePictureUrl: user.profilePictureUrl,
        createdAt: user.createdAt,
        views: user.viewCount,
      };
    } catch (error) {
      logger.error('Error fetching user info:', error);
      return null;
    }
  }

  async handleFirstTimeViewer(username) {
    try {
      // Check both cooldown and stream greetings
      if (this.isOnCooldown(username) || this.streamGreetings.has(username)) {
        return null;
      }

      // Add to stream greetings before generating message
      this.streamGreetings.add(username);

      const userInfo = await this.getUserInfo(username);
      const viewerData = viewerManager.data.viewers[username];

      const prompt = `Create a personalized welcome message for a first-time viewer. Details:
      - Username: ${username}
      ${
        userInfo
          ? `
      - Display Name: ${userInfo.displayName}
      - Bio: ${userInfo.description || 'No bio'}
      - Account Age: ${this.getAccountAge(userInfo.createdAt)}
      - Total Views: ${userInfo.views}`
          : ''
      }
      - Previous Visits: ${viewerData?.visits || 0}

      Guidelines:
      - Keep it natural and conversational
      - Reference their bio or interests if available
      - Encourage chat participation
      - Mention !commands availability
      - Keep it to one short paragraph
      - Make it feel personal and unique`;

      const welcomeMessage = await generateResponse(prompt);
      this.setCooldown(username);

      return (
        welcomeMessage ||
        `Welcome to the stream @${username}! 🎉 We're so happy to have you here! Feel free to join the chat and check out !commands to see what you can do!`
      );
    } catch (error) {
      logger.error('Error generating first-time viewer welcome:', error);
      return `Welcome to the stream @${username}! 🎉 We're so happy to have you here!`;
    }
  }

  async handleFollow(username) {
    try {
      // Prevent duplicate follow messages and check stream greetings
      if (this.recentFollows.has(username) || this.streamGreetings.has(username)) {
        return null;
      }

      // Add to stream greetings before generating message
      this.streamGreetings.add(username);

      const userInfo = await this.getUserInfo(username);
      const viewerData = viewerManager.data.viewers[username];
      const isRegularViewer = viewerData && viewerData.visits > 1;

      const prompt = `Create a personalized follow thank you message. Details:
      - Username: ${username}
      ${
        userInfo
          ? `
      - Display Name: ${userInfo.displayName}
      - Bio: ${userInfo.description || 'No bio'}
      - Account Age: ${this.getAccountAge(userInfo.createdAt)}
      - Total Views: ${userInfo.views}`
          : ''
      }
      - Previous Visits: ${viewerData?.visits || 1}
      - Viewer Type: ${isRegularViewer ? 'Regular viewer' : 'New viewer'}

      Guidelines:
      - Keep it natural and friendly
      - Reference their bio or interests if available
      - Acknowledge if they've been watching before following
      - Keep it to one short sentence
      - Make it feel personal and genuine`;

      const followMessage = await generateResponse(prompt);

      // Add to recent follows set and remove after 1 hour
      this.recentFollows.add(username);
      setTimeout(() => this.recentFollows.delete(username), 60 * 60 * 1000);

      // Add follow points
      viewerManager.addPoints(username, 100);

      return followMessage || `Thank you for the follow @${username}! 🎉 Welcome to our community!`;
    } catch (error) {
      logger.error('Error generating follow message:', error);
      return `Thank you for the follow @${username}! 🎉`;
    }
  }

  getAccountAge(createdAt) {
    if (!createdAt) {
      return 'Unknown';
    }
    const now = new Date();
    const created = new Date(createdAt);
    const diffYears = now.getFullYear() - created.getFullYear();
    const diffMonths = now.getMonth() - created.getMonth();

    if (diffYears > 0) {
      return `${diffYears} year${diffYears > 1 ? 's' : ''} old account`;
    } else if (diffMonths > 0) {
      return `${diffMonths} month${diffMonths > 1 ? 's' : ''} old account`;
    }
    const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    return `${diffDays} day${diffDays > 1 ? 's' : ''} old account`;
  }

  // Removed engagement prompts functionality

  isOnCooldown(username) {
    const lastMessage = this.welcomeMessageCooldown.get(username);
    return lastMessage && Date.now() - lastMessage < this.COOLDOWN_DURATION;
  }

  setCooldown(username) {
    this.welcomeMessageCooldown.set(username, Date.now());
  }
}

const welcomeManager = new WelcomeManager();
export default welcomeManager;
