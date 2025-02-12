import AIService from '../utils/aiService.js'; // Change to proper import
import logger from '../utils/logger.js';
import streamSummary from './streamSummary.js';

import { ApiClient } from '@twurple/api';
import { RefreshingAuthProvider } from '@twurple/auth';

class ChatInteraction {
  constructor() {
    this.chatData = {
      responses: {},
      patterns: {},
      userStats: {},
      chatPatterns: {},
      keywords: {},
      timePatterns: {},
      messagePatterns: [],
      sentimentHistory: {},
      engagementMetrics: {},
    };

    this.chatStats = {
      totalMessages: 0,
      totalInteractions: 0,
      chatMood: {
        current: {
          sentiment: 'neutral',
          energy: 'moderate',
        },
        history: [],
      },
      topTopics: [],
      activeHours: [],
      userStyles: {
        chatty: 0,
        lurker: 0,
        emoji: 0,
        memer: 0,
      },
    };

    this.isStreamActive = false;
    this.currentCategory = null;
    this.initializeTwitchApi();
    this.aiService = new AIService(); // Fixed instantiation
  }

  async initializeTwitchApi() {
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
        scope: ['channel:read:stream_key'],
      });

      this.apiClient = new ApiClient({ authProvider });
      this.updateCurrentCategory();
      // Update category every 5 minutes
      setInterval(() => this.updateCurrentCategory(), 5 * 60 * 1000);
    } catch (error) {
      logger.error('Failed to initialize Twitch API client:', error);
    }
  }

  async updateCurrentCategory() {
    try {
      const channel = process.env.TWITCH_CHANNEL;
      if (!channel) {
        return;
      }

      const user = await this.apiClient.users.getUserByName(channel);
      if (!user) {
        return;
      }

      const stream = await this.apiClient.streams.getStreamByUserId(user.id);
      if (stream) {
        this.currentCategory = stream.gameName;
        logger.debug('Updated current category:', this.currentCategory);
      }
    } catch (error) {
      logger.error('Error updating current category:', error);
    }
  }

  startStream() {
    this.isStreamActive = true;
    logger.info('Stream started');
    return 'Stream analytics and chat interaction started! 🎥';
  }

  async endStream() {
    try {
      this.isStreamActive = false;

      // Generate end of stream summary
      const summary = await streamSummary.generateEndOfStreamSummary();

      // Reset stream-specific stats
      this.chatStats.chatMood.history = [];
      this.chatStats.topTopics = [];
      this.chatStats.activeHours = [];

      logger.info('Stream ended, summary generated');

      return summary;
    } catch (error) {
      logger.error('Error ending stream:', error);
      return 'Stream ended, but there was an error generating the summary.';
    }
  }

  async handleChatMessage(username, message) {
    try {
      // Process all messages, including from broadcaster
      logger.debug('Processing message in chat interaction');

      // Update stats
      this.chatStats.totalMessages++;
      this.chatStats.totalInteractions++;

      // Update user stats
      if (!this.chatData.userStats[username]) {
        this.chatData.userStats[username] = {
          messages: 0,
          interactions: 0,
          style: 'lurker',
          lastActive: null,
          sentiment: {
            average: 0,
            history: [],
          },
          engagement: {
            score: 0,
            patterns: [],
          },
        };
      }

      const userStats = this.chatData.userStats[username];
      userStats.messages++;
      userStats.interactions++;
      userStats.lastActive = new Date().toISOString();

      // Perform AI analysis
      const messageAnalysis = await this.aiService.analyzeMessage(message, username);
      if (messageAnalysis) {
        // Update sentiment history
        userStats.sentiment.history.push({
          timestamp: Date.now(),
          score: messageAnalysis.sentiment,
          emotions: messageAnalysis.emotions,
        });

        // Keep only last 100 sentiment records
        if (userStats.sentiment.history.length > 100) {
          userStats.sentiment.history.shift();
        }

        // Update average sentiment
        userStats.sentiment.average =
          userStats.sentiment.history.reduce((sum, record) => sum + record.score, 0) /
          userStats.sentiment.history.length;

        // Update chat mood
        this.updateChatMood(messageAnalysis);
      }

      // Update content preferences with proper instance method
      await this.aiService.updateContentPreferences(username, message);

      // Learn from message patterns
      const pattern = this.findPattern(message);
      if (pattern) {
        this.chatData.patterns[pattern] = (this.chatData.patterns[pattern] || 0) + 1;
      }

      // Generate response if needed
      if (this.shouldRespond(message)) {
        const response = await this.generatePersonalizedResponse(message, username);
        if (response) {
          return response;
        }
      }

      return null;
    } catch (error) {
      logger.error('Error handling chat message:', error);
      return null;
    }
  }

  updateChatMood(messageAnalysis) {
    const { sentiment, emotions } = messageAnalysis;

    // Update current mood
    this.chatStats.chatMood.current = {
      sentiment: this.getSentimentLabel(sentiment),
      energy: this.getEnergyLevel(emotions),
    };

    // Add to mood history
    this.chatStats.chatMood.history.push({
      timestamp: Date.now(),
      mood: this.chatStats.chatMood.current,
    });

    // Keep only last hour of mood history
    const oneHourAgo = Date.now() - 3600000;
    this.chatStats.chatMood.history = this.chatStats.chatMood.history.filter(
      (record) => record.timestamp > oneHourAgo
    );
  }

  getSentimentLabel(score) {
    if (score > 0.7) {
      return 'very_positive';
    }
    if (score > 3) {
      return 'positive';
    }
    if (score < -0.7) {
      return 'very_negative';
    }
    if (score < -0.3) {
      return 'negative';
    }
    return 'neutral';
  }

  getEnergyLevel(emotions) {
    const energyEmotions = ['excitement', 'enthusiasm', 'anger', 'frustration'];
    const energyScore = Object.entries(emotions)
      .filter(([emotion]) => energyEmotions.includes(emotion))
      .reduce((sum, [_, intensity]) => sum + intensity, 0);

    if (energyScore > 0.7) {
      return 'high';
    }
    if (energyScore > 0.3) {
      return 'moderate';
    }
    return 'low';
  }

  findPattern(message) {
    const words = message.toLowerCase().split(' ');
    return words.length >= 3 ? words.slice(0, 3).join(' ') : null;
  }

  shouldRespond(message, username) {
    // Don't generate AI responses for command messages
    if (message.startsWith('!')) {
      return false;
    }

    // Always respond to direct mentions
    if (message.toLowerCase().includes(process.env.TWITCH_BOT_USERNAME?.toLowerCase() || '')) {
      return true;
    }

    // Check for questions or requests for information
    if (
      message.includes('?') ||
      /\b(who|what|where|when|why|how)\b/i.test(message) ||
      /\b(can you|could you|will|should|tell me|explain)\b/i.test(message)
    ) {
      return true;
    }

    // Check for game-specific questions first
    const gameQuestions = [
      /\b(what|how'?s?|how\s+is)\s+(?:the|this)\s+game\b/i,
      /\b(?:what|which)\s+game\s+(?:is\s+this|are\s+(?:you|we)\s+playing)\b/i,
      /\bwhat\s+(?:are|is)\s+(?:you|we)\s+playing\b/i,
      /\b(?:what|how)\s+does\s+this\s+game\s+work\b/i,
      /\b(?:what'?s?|what\s+is)\s+(?:going\s+on|happening)\b/i,
      /\b(?:what'?s?|what\s+is)\s+the\s+objective\b/i,
    ];

    if (gameQuestions.some((pattern) => pattern.test(message))) {
      return true;
    }

    // Check for other topics or keywords
    const generalTopics = [
      /\b(sports?|game|match|team|score|win|lose|play(er|ing)?|superbowl|football)\b/i,
      /\b(news|update|event|happen(ed|ing)?)\b/i,
      /\b(weather|forecast|temperature|rain|snow|storm)\b/i,
      /\b(tech|computer|phone|app|software|website)\b/i,
      /\b(movie|show|series|episode|watch(ing)?)\b/i,
      /\b(music|song|artist|album|concert)\b/i,
      /\b(food|drink|restaurant|recipe|cook(ing)?)\b/i,
    ];

    if (generalTopics.some((pattern) => pattern.test(message))) {
      return true;
    }

    // Check for predictions or suggestions
    if (
      /\b(suggest|recommend|think|believe|maybe|probably)\b/i.test(message) ||
      /\b(predict|bet|guess|expect)\b/i.test(message)
    ) {
      return true;
    }

    return false;
  }

  hasSubstantiveContent(message) {
    // This method is now deprecated as its functionality is merged into shouldRespond
    return true;
  }

  isHighEngagementMessage(message) {
    const topicIndicators = {
      sports: /\b(game|match|team|player|score|win|lose|superbowl|football|basketball|baseball)\b/i,
      predictions:
        /\b(predict|prediction|chance|odds|likely|probably|might|could|think|bet|guess)\b/i,
      gameplay: /\b(strat(egy)?|mechanic|technique|skill|combo|timing)\b/i,
      technical: /\b(settings|config|setup|fps|graphics|performance)\b/i,
      meta: /\b(meta|tier|balance|patch|update|nerf|buff)\b/i,
      progression: /\b(level|rank|achievement|quest|mission|challenge)\b/i,
      equipment: /\b(gear|weapon|build|loadout|equipment|item)\b/i,
      teamplay: /\b(team|group|party|squad|comp|coordination)\b/i,
      competition: /\b(tournament|match|scrim|practice|competitive)\b/i,
      questions: /\b(who|what|where|when|why|how)\b.*?\?/i,
      suggestions: /\b(suggest|recommend|advise|maybe|perhaps)\b/i,
    };

    // Count specific topic matches
    const topicMatches = Object.values(topicIndicators).filter((pattern) =>
      pattern.test(message)
    ).length;

    // Engage if discussing any recognized topics
    return topicMatches > 0;
  }

  async generatePersonalizedResponse(message, username) {
    try {
      const userStats = this.chatData.userStats[username];
      const recentMessages = this.getRecentMessages(5);
      const chatContext = {
        currentCategory: this.currentCategory,
        chatMood: this.chatStats.chatMood.current,
        userStats: {
          messages: userStats?.messages || 0,
          style: userStats?.style || 'new',
          sentiment: userStats?.sentiment.average || 0,
        },
        recentContext: recentMessages.map((msg) => ({
          username: msg.username,
          message: msg.message,
          timestamp: msg.timestamp,
        })),
        topTopics: this.chatStats.topTopics.slice(0, 3),
        gameContext: this.currentCategory
          ? {
              game: this.currentCategory,
              isGameRelated: /\b(game|playing|match|score|how'?s?\s+(?:the|it)\s+going)\b/i.test(
                message
              ),
            }
          : null,
      };

      // Generate contextual response
      const response = await this.aiService.generateResponse(
        message,
        username,
        chatContext
      );

      // Track this interaction
      if (response) {
        this.trackInteraction(username, 'bot_response', {
          trigger: message,
          response,
        });
      }

      return response;
    } catch (error) {
      logger.error('Error generating personalized response:', error);
      return null;
    }
  }

  getRecentMessages(count = 5) {
    const messages = [];
    for (const [username, stats] of Object.entries(this.chatData.userStats)) {
      if (stats.lastMessage) {
        messages.push({
          username,
          message: stats.lastMessage.content,
          timestamp: stats.lastMessage.timestamp,
        });
      }
    }

    return messages.sort((a, b) => b.timestamp - a.timestamp).slice(0, count);
  }

  trackInteraction(username, type, data) {
    if (!this.chatData.userStats[username]) {
      this.chatData.userStats[username] = {
        messages: 0,
        interactions: 0,
        style: 'new',
        lastActive: null,
        lastMessage: null,
        sentiment: {
          average: 0,
          history: [],
        },
        engagement: {
          score: 0,
          patterns: [],
        },
      };
    }

    const stats = this.chatData.userStats[username];
    stats.interactions++;
    stats.lastActive = Date.now();

    if (type === 'chat') {
      stats.lastMessage = {
        content: data.message,
        timestamp: Date.now(),
      };
    }
  }

  getStats() {
    return {
      ...this.chatStats,
      aiMetrics: {
        activeUsers: Object.keys(this.chatData.userStats).length,
        patterns: Object.keys(this.chatData.patterns).length,
      },
    };
  }

  getTotalInteractions() {
    return this.chatStats.totalInteractions;
  }

  chatCommands = {
    '!points': async (username) => {
      const userStats = this.chatData.userStats[username];
      if (!userStats) {
        return `@${username} has no points yet! Start chatting to earn some!`;
      }
      return `@${username} has ${userStats.interactions} points!`;
    },

    '!lastactive': async (username) => {
      const userStats = this.chatData.userStats[username];
      if (!userStats?.lastActive) {
        return `@${username} hasn't been active yet!`;
      }
      const lastActive = new Date(userStats.lastActive);
      const timeAgo = Math.floor((Date.now() - lastActive.getTime()) / 1000 / 60);
      return `@${username} was last active ${timeAgo} minutes ago`;
    },

    '!chatstats': async (username) => {
      const userStats = this.chatData.userStats[username];
      if (!userStats) {
        return `@${username} has no chat stats yet!`;
      }
      const preferences = AIService.getContentPreferences(username);
      const topTopics = preferences
        ? Object.entries(preferences.topics)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([topic]) => topic)
            .join(', ')
        : 'None yet';

      return `@${username}'s Stats: Messages: ${userStats.messages} | Style: ${
        userStats.style
      } | Mood: ${this.getSentimentLabel(userStats.sentiment.average)} | Top Topics: ${topTopics} | Active since: ${new Date(userStats.lastActive).toLocaleString()}`;
    },

    '!mood': async () => {
      const currentMood = this.chatStats.chatMood.current;
      return `Current chat mood: ${currentMood.sentiment} with ${currentMood.energy} energy`;
    },

    '!engagement': async (username) => {
      const userStats = this.chatData.userStats[username];
      if (!userStats) {
        return `@${username} has no engagement stats yet!`;
      }
      const preferences = AIService.getContentPreferences(username);
      const style = AIService.determineInteractionStyle(username);
      return `@${username}'s Engagement: Style: ${style} | Messages: ${userStats.messages} | Interaction Score: ${Math.round(userStats.sentiment.average * 100)}%`;
    },
  };
}

const chatInteraction = new ChatInteraction();
export default chatInteraction;
