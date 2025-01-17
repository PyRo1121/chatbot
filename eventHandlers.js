import responseHandler from './responseHandler.js';
import logger from './utils/logger.js';
import { client } from './bot.js';

export default {
  setupEventHandlers: () => {
    client.on('subscription', (channel, username, method, message, userstate) => {
      handleEvent(client, channel, username, 'sub');
    });

    client.on('resub', (channel, username, months, message, userstate, methods) => {
      handleEvent(client, channel, username, 'resub');
    });

    client.on('raid', (channel, username, viewers) => {
      handleEvent(client, channel, username, 'raid');
    });

    client.on('follow', (channel, username) => {
      handleEvent(client, channel, username, 'follow');
    });
  }
};

async function handleEvent(client, channel, username, eventType) {
  logger.info(`Handling ${eventType} event from ${username}`);
  try {
    const response = await responseHandler.generateCheekyResponse(username, eventType);
    client.say(channel, response);
    logger.info(`Successfully handled ${eventType} event for ${username}`);
  } catch (error) {
    logger.error(`Error handling ${eventType} event: ${error.message}`);
    client.say(channel, `Thanks for the ${eventType}, ${username}!`);
  }
}
