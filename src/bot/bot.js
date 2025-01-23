import { renderTemplate, broadcastUpdate } from '../overlays/overlays.js';
import logger from '../utils/logger.js';
import twitchClient from './twitchClient.js';
import chatInteraction from './chatInteraction.js';
import {
  handlePing,
  handleRoast,
  handleListQueue,
  handleClearQueue,
  handleRemoveFromQueue,
  handleSongRequest,
  processSongQueue,
  commandList,
} from './commands/index.js';

// Setup message handler
function setupMessageHandler() {
  twitchClient.client.on('message', async (channel, tags, message, self) => {
    if (self) {
      return;
    }

    try {
      // Check for witty response opportunity if not a command
      if (!message.startsWith('!')) {
        const wittyResponse = await chatInteraction.getWittyResponse(message, tags.username);
        if (wittyResponse) {
          twitchClient.client.say(channel, wittyResponse);
          return;
        }
      }

      if (message.startsWith('!')) {
        const command = message.split(' ')[0].toLowerCase();
        const args = message.split(' ').slice(1);

        let response = null;

        switch (command) {
          case '!ping':
            response = handlePing();
            break;

          case '!commands':
            response = {
              success: true,
              message: `Available commands: ${commandList}`,
            };
            break;

          case '!songrequest':
            if (args.length > 0) {
              response = await handleSongRequest(tags.username, args.join(' '), twitchClient);
              if (response.success) {
                const queueContent = renderTemplate('queue', {
                  songs: JSON.stringify(response.song),
                });
                broadcastUpdate(queueContent);
              }
            } else {
              response = {
                success: false,
                message: 'Usage: !songrequest [song name]',
              };
            }
            break;

          case '!queue':
            response = handleListQueue();
            break;

          case '!queueclear':
            response = handleClearQueue(tags.username);
            break;

          case '!queueremove':
            if (args.length > 0) {
              const index = parseInt(args[0], 10);
              response = handleRemoveFromQueue(tags.username, index);
            } else {
              response = {
                success: false,
                message: 'Usage: !queueremove [position number]',
              };
            }
            break;

          case '!roast':
            if (args.length > 0) {
              const targetUser = args[0].replace('@', '');
              response = await handleRoast(twitchClient, channel, targetUser);
            } else {
              response = {
                success: false,
                message: 'Usage: !roast @username',
              };
            }
            break;
        }

        if (response) {
          twitchClient.client.say(channel, response.message);
        }
      }
    } catch (error) {
      logger.error('Error in message handler:', error);
    }
  });
}

// Setup handlers and process queue
setupMessageHandler();
setInterval(() => {
  if (twitchClient.client) {
    processSongQueue();
  }
}, 30000);

export { twitchClient };
