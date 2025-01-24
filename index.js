import 'dotenv/config';
import { initBot } from './src/bot/bot.js';
import logger from './src/utils/logger.js';

// Start the bot
logger.info('Starting Twitch chat bot...');

(async () => {
  try {
    const twitchClient = await initBot();
    await twitchClient.client.connect();
    logger.info('Successfully connected to Twitch');
  } catch (error) {
    logger.error('Failed to connect to Twitch:', error);
    process.exit(1);
  }
})();
