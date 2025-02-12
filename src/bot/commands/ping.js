import logger from '../../utils/logger.js';
import { uptime } from 'node:os';
import { performance } from 'node:perf_hooks';

// Track first ping time for uptime calculation
const firstPingTime = Date.now();

/**
 * Format milliseconds into human readable time
 * @param {number} ms - Milliseconds to format
 * @returns {string} Formatted time string
 */
function formatUptime(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  return [
    days && `${days}d`,
    hours && `${hours}h`,
    minutes && `${minutes}m`,
    seconds && `${seconds}s`,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Handle !ping command - Respond with latency and uptime stats
 * @param {number} [startTime=performance.now()] - Timestamp when command was received
 * @returns {string} Formatted ping response
 */
export function handlePing(startTime = performance.now()) {
  logger.debug('handlePing called');

  try {
    // Validate startTime
    let validStartTime = startTime;
    if (typeof validStartTime !== 'number' || validStartTime <= 0) {
      validStartTime = performance.now();
      logger.warn('Invalid startTime in handlePing, using current time');
    }

    // Calculate latency
    const latency = Math.round(performance.now() - validStartTime);

    // Get system uptime
    const systemUptime = formatUptime(uptime() * 1000);

    // Get bot uptime
    const botUptime = formatUptime(Date.now() - firstPingTime);

    // Build response
    const response = `🏓 Pong! | Latency: ${latency}ms | System: ${systemUptime} | Bot: ${botUptime}`;

    logger.debug('Ping response generated:', {
      response,
      latency,
      systemUptime,
      botUptime,
    });

    return response;
  } catch (error) {
    logger.error('Error handling ping command:', error, { stack: error.stack });
    return '⚠️ Error processing ping command. Please try again later.';
  }
}
