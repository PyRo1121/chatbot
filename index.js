import 'dotenv/config';
import { initBot } from './src/bot/bot.js';
import logger from './src/utils/logger.js';

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

// Main execution
(async () => {
  try {
    logger.info('Starting Twitch chat bot...');
    
    const client = await initBot();
    if (!client) {
      throw new Error('Failed to initialize bot - no client returned');
    }

    logger.info('Bot started successfully');

    // Graceful shutdown handler
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down bot...`);
      try {
        // Cleanup will be handled by the bot's SIGINT handler
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Process signal handlers
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    logger.error('Fatal error during bot startup:', error);
    process.exit(1);
  }
})();
