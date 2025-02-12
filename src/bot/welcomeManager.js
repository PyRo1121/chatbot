import { generateResponse } from '../utils/gemini.js';
import logger from '../utils/logger.js';
import viewerManager from './viewerManager.js';
import { ApiClient } from '@twurple/api';
import { RefreshingAuthProvider } from '@twurple/auth';
import { sentimentHandler } from '../utils/sentimentHandler.js';
import aiService from '../utils/aiService.js';

class WelcomeManager {
  constructor() {
    this.recentFollows = new Set();
    this.welcomeMessageCooldown = new Map();
    this.COOLDOWN_DURATION = 30 * 60 * 1000; // 30 minutes
    this.apiClient = null;
    this.streamGreetings = new Set(); // Track greetings for current stream
    this.contextMemory = new Map();
    this.moodBasedGreetings = {
      very_positive: [
        "The chat's buzzing with energy! Welcome, {username}! 🎉",
        'Perfect timing {username}! We\'re having a blast! 🌟',
      ],
      positive: [
        'Great to see you {username}! Chat\'s in a good mood today! 😊',
        'Welcome {username}! You\'re joining us at a fun time! 🎈',
      ],
      neutral: [
        'Welcome to the stream {username}! 👋',
        'Hey there {username}! Make yourself at home! 💫',
      ],
      negative: [
        'Welcome {username}! Help us brighten up the mood! ✨',
        'Hey {username}! Perfect timing - we could use some positive vibes! 🌈',
      ],
      very_negative: [
        'Welcome {username}! Let\'s turn this mood around together! 🌟',
        'Hey {username}! Your presence might be just what we need! 💫',
      ],
      contextual: {
        returningUser: {
          positive: "Welcome back {username}! Chat's been missing your positive energy! 🌟",
          neutral: "Good to see you again {username}! Hope you're ready for another great stream! 👋",
          negative: "Welcome back {username}! Let's make this stream amazing together! 💫",
        },
        firstTimer: {
          positive: "First time here {username}? You picked a great time to join! Chat's buzzing! 🎉",
          neutral: 'Welcome to your first stream {username}! Make yourself at home! 🏡',
          negative: 'Welcome {username}! New faces always brighten up the stream! ✨',
        },
      },
    };
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
      if (this.isOnCooldown(username) || this.streamGreetings.has(username)) {
        return null;
      }

      const userInfo = await this.getUserInfo(username);
      const viewerData = viewerManager.data.viewers[username];
      const chatMood = aiService.chatMood.overall;
      const userContext = this.getViewerContext(username);

      // Get user's sentiment history if available
      const userMood = sentimentHandler.getUserMoodSummary(username);
      const channelMood = sentimentHandler.getChannelMoodSummary();

      const prompt = `Create a personalized welcome message.
        User Context:
        ${userMood ? `- User Mood: ${userMood.currentMood}
        - Dominant Emotion: ${Object.keys(userMood.dominantEmotion)[0]}` : ''}
        - Chat Mood: ${channelMood.current}
        ${this.getExistingPromptDetails(username, userInfo, viewerData)}`;

      const response = await generateResponse(prompt);
      this.updateViewerContext(username);
      this.streamGreetings.add(username);

      return response || this.getMoodBasedGreeting(chatMood, username);
    } catch (error) {
      logger.error('Error in welcome generation:', error);
      return this.getMoodBasedGreeting('neutral', username);
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

  isOnCooldown(username) {
    const lastMessage = this.welcomeMessageCooldown.get(username);
    return lastMessage && Date.now() - lastMessage < this.COOLDOWN_DURATION;
  }

  setCooldown(username) {
    this.welcomeMessageCooldown.set(username, Date.now());
  }

  getMoodBasedGreeting(mood, username) {
    const greetings = this.moodBasedGreetings[mood] || this.moodBasedGreetings.neutral;
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    return greeting.replace('{username}', username);
  }

  getViewerContext(username) {
    return this.contextMemory.get(username) || {
      firstSeen: Date.now(),
      lastSeen: null,
      interactions: 0,
      preferences: {},
      messageHistory: [],
    };
  }

  updateViewerContext(username, message = null) {
    const context = this.getViewerContext(username);
    context.lastSeen = Date.now();
    context.interactions++;

    if (message) {
      context.messageHistory.push({
        timestamp: Date.now(),
        content: message,
      });

      // Keep only last 10 messages
      if (context.messageHistory.length > 10) {
        context.messageHistory.shift();
      }
    }

    this.contextMemory.set(username, context);
  }

  getActivityLevel() {
    const recentMessages = Array.from(this.contextMemory.values()).filter(
      (ctx) => Date.now() - ctx.lastSeen < 5 * 60 * 1000
    ).length;

    if (recentMessages > 20) {
      return 'very_active';
    }
    if (recentMessages > 10) {
      return 'active';
    }
    if (recentMessages > 5) {
      return 'moderate';
    }
    return 'quiet';
  }

  getTimeSince(timestamp) {
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }
    return `${Math.floor(hours / 24)}d ago`;
  }
}

const welcomeManager = new WelcomeManager();
export default welcomeManager;
