import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { generateResponse } from '../utils/perplexity.js';
import logger from '../utils/logger.js';

class ChatInteraction {
  constructor() {
    this.chatData = this.loadChatData();
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
  }

  loadChatData() {
    try {
      const data = readFileSync(
        join(process.cwd(), 'src/bot/chat_learning.json'),
        'utf8'
      );
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error loading chat data:', error);
      return {
        responses: {},
        patterns: {},
        userStats: {},
      };
    }
  }

  saveChatData() {
    try {
      writeFileSync(
        join(process.cwd(), 'src/bot/chat_learning.json'),
        JSON.stringify(this.chatData, null, 2)
      );
    } catch (error) {
      logger.error('Error saving chat data:', error);
    }
  }

  async handleChatMessage(username, message) {
    try {
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
        };
      }

      const userStats = this.chatData.userStats[username];
      userStats.messages++;
      userStats.interactions++;
      userStats.lastActive = new Date().toISOString();

      // Analyze chat style
      if (message.includes('!')) {
        userStats.style = 'chatty';
        this.chatStats.userStyles.chatty++;
      } else if (message.match(/[\u{1F300}-\u{1F9FF}]/u)) {
        userStats.style = 'emoji';
        this.chatStats.userStyles.emoji++;
      } else if (
        message.toLowerCase().includes('kappa') ||
        message.toLowerCase().includes('pogchamp')
      ) {
        userStats.style = 'memer';
        this.chatStats.userStyles.memer++;
      }

      // Learn from message patterns
      const pattern = this.findPattern(message);
      if (pattern) {
        this.chatData.patterns[pattern] =
          (this.chatData.patterns[pattern] || 0) + 1;
      }

      // Generate response if needed
      if (this.shouldRespond(message)) {
        const response = await this.generateResponse(message);
        if (response) {
          this.chatData.responses[message.toLowerCase()] = response;
          this.saveChatData();
          return response;
        }
      }

      // Save periodically
      if (this.chatStats.totalMessages % 100 === 0) {
        this.saveChatData();
      }

      return null;
    } catch (error) {
      logger.error('Error handling chat message:', error);
      return null;
    }
  }

  findPattern(message) {
    // Simple pattern matching for now
    const words = message.toLowerCase().split(' ');
    return words.length >= 3 ? words.slice(0, 3).join(' ') : null;
  }

  shouldRespond(message) {
    // Respond to direct mentions and questions
    return (
      message
        .toLowerCase()
        .includes(process.env.BOT_USERNAME?.toLowerCase() || '') ||
      message.includes('?')
    );
  }

  async generateResponse(message) {
    try {
      // Check for cached response
      const cached = this.chatData.responses[message.toLowerCase()];
      if (cached) {
        return cached;
      }

      // Generate new response
      return await generateResponse(
        `Generate a friendly and engaging response to this Twitch chat message: "${message}". Keep it concise (max 200 characters) and appropriate for stream chat.`
      );
    } catch (error) {
      logger.error('Error generating chat response:', error);
      return null;
    }
  }

  getStats() {
    return this.chatStats;
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
      const timeAgo = Math.floor(
        (Date.now() - lastActive.getTime()) / 1000 / 60
      );
      return `@${username} was last active ${timeAgo} minutes ago`;
    },

    '!chatstats': async (username) => {
      const userStats = this.chatData.userStats[username];
      if (!userStats) {
        return `@${username} has no chat stats yet!`;
      }
      return `@${username}'s Stats: Messages: ${userStats.messages} | Style: ${
        userStats.style
      } | Active since: ${new Date(userStats.lastActive).toLocaleString()}`;
    },
  };
}

const chatInteraction = new ChatInteraction();
export default chatInteraction;
