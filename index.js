import 'dotenv/config';
import { client } from './bot.js';
import logger from './utils/logger.js';

// Start the bot
logger.info('Starting Twitch chat bot...');
client.connect()
  .then(() => logger.info('Successfully connected to Twitch'))
  .catch(error => {
    logger.error('Failed to connect to Twitch:', error);
    process.exit(1);
  });
