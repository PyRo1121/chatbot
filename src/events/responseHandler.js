import { generateResponse } from '../utils/perplexity.js';
import logger from '../utils/logger.js';
import spotify from '../spotify/spotify.js';

class ResponseHandler {
  constructor() {
    this.responsePatterns = new Map();
    this.initializePatterns();
  }

  initializePatterns() {
    // Add basic response patterns
    this.responsePatterns.set(/thank.*bot/i, (message) =>
      this.generateThankYouResponse(message)
    );
    this.responsePatterns.set(
      /good.*bot/i,
      () => '🤖 💚 Thank you! I try my best to help!'
    );
    this.responsePatterns.set(
      /bad.*bot/i,
      () => "🤖 I apologize for any issues. I'm always trying to improve!"
    );
    this.responsePatterns.set(
      /what.*commands/i,
      () => 'Type !help to see all available commands!'
    );
  }

  async handleMessage(message, username) {
    try {
      // Check for song requests
      if (
        message.toLowerCase().startsWith('!sr ') ||
        message.toLowerCase().startsWith('!songrequest ')
      ) {
        return await this.handleSongRequest(message, username);
      }

      // Check for custom patterns
      for (const [pattern, handler] of this.responsePatterns) {
        if (pattern.test(message)) {
          return await handler(message);
        }
      }

      // Generate response for direct mentions
      if (
        message
          .toLowerCase()
          .includes(process.env.BOT_USERNAME?.toLowerCase() || '')
      ) {
        return await this.generateChatResponse(message);
      }

      return null;
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
