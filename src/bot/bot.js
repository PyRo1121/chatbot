import getClient from './twitchClient.js';
import analytics from './analytics.js';
import {
  processSongQueue,
  handleChatActivity,
  streamEventHandlers,
  handleClip,
  handleHighlights,
  handleTitle,
  handleCategory,
  handleUptime,
  handleMilestone,
  handleSuspiciousFollowers,
  handleClearSuspicious,
  handleFollowSettings,
} from './commands/index.js';

async function initBot() {
  const twitchClient = await getClient();

  // Start analytics tracking
  analytics.startStream();

  // Register stream event handlers
  streamEventHandlers.onStreamStart();

  // Setup command handlers
  twitchClient.client.on('message', async (channel, user, message, self) => {
    if (self) {
      return;
    }

    // Handle chat activity for auto-clips
    await handleChatActivity(twitchClient.client, channel, user, message);

    // Handle commands
    const [command] = message.toLowerCase().split(' ');
    const args = message.slice(command.length).trim();

    // Response variables for follow protection commands
    let suspiciousResponse, clearResponse, settingsResponse;

    switch (command) {
      case '!clip':
        await handleClip(twitchClient.client, channel, user, args);
        break;
      case '!highlights':
        await handleHighlights(twitchClient.client, channel, user, args);
        break;
      case '!title':
        if (user.isBroadcaster || user.isMod) {
          await handleTitle(twitchClient.client, channel, user, args);
        }
        break;
      case '!category':
        if (user.isBroadcaster || user.isMod) {
          await handleCategory(twitchClient.client, channel, user, args);
        }
        break;
      case '!uptime':
        await handleUptime(twitchClient.client, channel, user, args);
        break;
      case '!milestone':
        if (user.isBroadcaster || user.isMod) {
          await handleMilestone(twitchClient.client, channel, user, args);
        }
        break;
      case '!suspicious':
        suspiciousResponse = await handleSuspiciousFollowers(
          twitchClient.client,
          channel,
          user,
          args,
          user.isBroadcaster
        );
        if (suspiciousResponse) {
          twitchClient.client.say(channel, suspiciousResponse.message);
        }
        break;
      case '!clearsuspicious':
        clearResponse = await handleClearSuspicious(
          twitchClient.client,
          channel,
          user,
          args,
          user.isBroadcaster
        );
        if (clearResponse) {
          twitchClient.client.say(channel, clearResponse.message);
        }
        break;
      case '!followsettings':
        settingsResponse = await handleFollowSettings(
          twitchClient.client,
          channel,
          user,
          args,
          user.isBroadcaster
        );
        if (settingsResponse) {
          twitchClient.client.say(channel, settingsResponse.message);
        }
        break;
    }
  });

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
  process.on('SIGINT', async () => {
    await streamEventHandlers.onStreamEnd();
    analytics.endStream();
    process.exit();
  });

  return twitchClient;
}

export { initBot };
