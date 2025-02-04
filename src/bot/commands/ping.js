import logger from '../../utils/logger.js';

export function handlePing() {
  logger.debug('handlePing called');

  try {
    const response = '🏓 Pong!';
    logger.debug('Ping response generated:', { response });
    return response;
  } catch (error) {
    logger.error('Error handling ping command:', error);
    return 'Error processing ping command';
  }
}
