import logger from '../../utils/logger.js';
import { generateResponse } from '../../utils/perplexity.js';

export async function handleLurk(client, channel, user) {
  try {
    const systemPrompt = `You are a witty Twitch chat bot that generates hilarious lurk messages. Be creative, playful, and slightly cheeky - but keep it friendly and PG. Your response should be a single sentence about how the user is lurking in a funny way. Include their username in the message.`;

    const prompt = `Generate a funny lurk message for Twitch user "${user.username}" who just used the !lurk command.`;

    const response = await generateResponse(prompt, systemPrompt);

    if (!response) {
      return `${user.username} sneaks away into lurk mode... (very sneakily)`;
    }

    return response;
  } catch (error) {
    logger.error('Error generating lurk message:', error);
    return `${user.username} disappears into the shadows... (probably to grab snacks)`;
  }
}
