import logger from '../utils/logger.js';
import getClient from './twitchClient.js';
import analytics from './analytics.js';
import { processSongQueue } from './commands/index.js';

async function initBot() {
  const twitchClient = await getClient();

  // Start analytics tracking
  analytics.startStream();

  // Setup intervals
  setInterval(() => {
    if (twitchClient.client) {
      processSongQueue();
    }
  }, 30000);

  // Clean up analytics data periodically
  setInterval(
    () => {
      analytics.cleanup();
    },
    24 * 60 * 60 * 1000
  ); // Once per day

  // Handle stream end
  process.on('SIGINT', () => {
    analytics.endStream();
    process.exit();
  });

  return twitchClient;
}

export { initBot };
