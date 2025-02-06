import spotify from '../spotify/spotify.js';
import { generateResponse } from '../utils/deepseek.js';
import logger from '../utils/logger.js';
import { LRUCache } from 'lru-cache';

class ResponseHandler {
  constructor() {
    // Initialize caches
    this.cache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 5, // 5 minutes
    });

    // Setup patterns
    this.responsePatterns = new Map();
    this.compiledPatterns = new Map();

    // Rate limiting
    this.messageCount = 0;
    this.lastReset = Date.now();
    this.rateLimit = 100; // messages per minute

    this.initializePatterns();
  }

  initializePatterns() {
    this.responsePatterns.set(/thank.*bot/i, (message) => this.generateThankYouResponse(message));
    this.responsePatterns.set(/good.*bot/i, () => '🤖 💚 Thank you! I try my best to help!');
    this.responsePatterns.set(
      /bad.*bot/i,
      () => "🤖 I apologize for any issues. I'm always trying to improve!"
    );
    this.responsePatterns.set(/what.*commands/i, () => 'Type !help to see all available commands!');
  }

  async handleMessage(message, username) {
    try {
      // Rate limiting check
      if (!this.checkRateLimit()) {
        return null;
      }

      // Check cache
      const cacheKey = `${username}:${message.toLowerCase()}`;
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      let response = null;

      // Keep original song request logic
      if (
        message.toLowerCase().startsWith('!sr ') ||
        message.toLowerCase().startsWith('!songrequest ')
      ) {
        response = await this.handleSongRequest(message, username);
      } else {
        // Pattern matching
        for (const [pattern, handler] of this.responsePatterns) {
          if (pattern.test(message)) {
            response = await handler(message);
            break;
          }
        }

        // Bot mentions
        if (
          !response &&
          message.toLowerCase().includes(process.env.BOT_USERNAME?.toLowerCase() || '')
        ) {
          response = await this.generateChatResponse(message);
        }
      }

      // Cache successful responses
      if (response) {
        this.cache.set(cacheKey, response);
      }

      return response;
    } catch (error) {
      logger.error('Error handling message:', error);
      return null;
    }
  }

  async handleSongRequest(message, username) {
    try {
      const query = message.split(' ').slice(1).join(' ');
      const result = await spotify.handleSongRequest(query, username);
      return result;
    } catch (error) {
      logger.error('Error handling song request:', error);
      return 'Sorry, there was an error processing your song request.';
    }
  }

  checkRateLimit() {
    const now = Date.now();
    if (now - this.lastReset > 60000) {
      this.messageCount = 0;
      this.lastReset = now;
    }

    this.messageCount++;
    return this.messageCount <= this.rateLimit;
  }

  async generateThankYouResponse(message) {
    try {
      const prompt = `Generate a friendly and appreciative response to this thank you message: "${message}". 
      Keep it concise (max 100 characters) and use emojis appropriately.`;

      const response = await generateResponse(prompt);
      return response || "🤖 You're welcome! Happy to help! 💚";
    } catch (error) {
      logger.error('Error generating thank you response:', error);
      return "🤖 You're welcome! Happy to help! 💚";
    }
  }

  async generateChatResponse(message) {
    try {
      const prompt = `Generate a friendly and engaging response to this Twitch chat message: "${message}".
      Keep it concise (max 200 characters) and appropriate for stream chat.
      Use emojis where appropriate.`;

      const response = await generateResponse(prompt);
      return response || 'Thanks for chatting with me! 🤖';
    } catch (error) {
      logger.error('Error generating chat response:', error);
      return 'Thanks for chatting with me! 🤖';
    }
  }
}

export default new ResponseHandler();
