import responseHandler from './responseHandler.js';
import logger from './utils/logger.js';
import { client } from './bot.js';

export default {
  setupEventHandlers: () => {
    client.on(
      'subscription',
      (channel, username, method, message, userstate) => {
        handleEvent(client, channel, username, 'sub', {
          method,
          message,
          userstate,
        });
      }
    );

    client.on(
      'resub',
      (channel, username, months, message, userstate, methods) => {
        handleEvent(client, channel, username, 'resub', {
          months,
          message,
          userstate,
          methods,
        });
      }
    );

    client.on('raid', (channel, username, viewers) => {
      handleEvent(client, channel, username, 'raid', { viewers });
    });

    client.on('follow', (channel, username) => {
      handleEvent(client, channel, username, 'follow', {});
    });
  },
};

async function handleEvent(
  twitchClient,
  channel,
  username,
  eventType,
  eventData
) {
  logger.info(`Handling ${eventType} event from ${username}`);
  try {
    const response = await responseHandler.generateCheekyResponse(
      username,
      eventType,
      eventData
    );
    twitchClient.say(channel, response);
    logger.info(`Successfully handled ${eventType} event for ${username}`);
  } catch (error) {
    logger.error(`Error handling ${eventType} event: ${error.message}`);
    twitchClient.say(channel, `Thanks for the ${eventType}, ${username}!`);
  }
}
