import { generateResponse } from '../../utils/gemini.js';
import logger from '../../utils/logger.js';

/**
 * Handle !lurk command - Generate a funny lurk message
 * @param {Object} client - Twitch client instance
 * @param {string} channel - Channel name
 * @param {Object} user - User object containing username
 * @returns {Promise<string>} Generated lurk message
 */
export async function handleLurk(twitchClient, channel, user) {
  try {
    const prompt = `Create a single fun, casual lurk message for Twitch user ${user.username}.
    Requirements:
    - Make it playful but not rude
    - Include an emoji
    - No multiple options, just one message
    - Don't use "has entered lurk mode" or similar generic phrases`;

    const response = await generateResponse(prompt);
    if (!response) {
      return `@${user.username} is now lurking! 👋`;
    }

    // Clean up response
    return response
      .replace(/Option \d:?/gi, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch (error) {
    logger.error('Error handling lurk command:', error);
    return `@${user.username} is now lurking! 👋`;
  }
}
