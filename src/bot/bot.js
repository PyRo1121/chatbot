import getClient from './twitchClient.js';
import analytics from './analytics.js';
import chatInteraction from './chatInteraction.js';
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
  handleRecommendations,
} from './commands/index.js';
import { detectHighlight } from './streamManager.js';

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

    // Store and analyze message
    chatInteraction.storeMessage(user.username, message);

    // Get witty response if appropriate
    const response = await chatInteraction.getWittyResponse(message, user.username);
    if (response) {
      twitchClient.client.say(channel, response);
    }

    // Check for potential highlight moment
    const chatStats = chatInteraction.getStats();
    const viewerCount = 0; // This should be fetched from Twitch API
    const isHighlight = await detectHighlight(message, viewerCount, chatStats.totalInteractions);
    if (isHighlight) {
      twitchClient.client.say(channel, '📸 This moment has been marked as a stream highlight!');
    }

    // Handle chat activity for auto-clips
    await handleChatActivity(twitchClient.client, channel, user, message);

    // Handle commands
    const [command] = message.toLowerCase().split(' ');
    const args = message.slice(command.length).trim();

    // Response variables for follow protection commands
    let suspiciousResponse, clearResponse, settingsResponse;

    // Check broadcaster status (both by badge and username)
    const isBroadcaster =
      user.badges?.broadcaster === '1' || user.username === channel.replace('#', '');

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
          isBroadcaster
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
          isBroadcaster
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
          isBroadcaster
        );
        if (settingsResponse) {
          twitchClient.client.say(channel, settingsResponse.message);
        }
        break;
      case '!chatinsights':
        handleChatInsights(twitchClient.client, channel);
        break;
      case '!recommendations': {
        const recResponse = await handleRecommendations();
        twitchClient.client.say(channel, recResponse);
        break;
      }
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

function handleChatInsights(client, channel) {
  const stats = chatInteraction.getStats();
  const insights = [
    `Chat Mood: ${stats.chatMood.current.sentiment} (Energy: ${stats.chatMood.current.energy})`,
    `Top Topics: ${stats.topTopics
      .slice(0, 3)
      .map((t) => `${t.topic}(${t.count})`)
      .join(', ')}`,
    `Most Active Hour: ${stats.activeHours[0]?.hour}:00`,
    `Total Interactions: ${stats.totalInteractions}`,
    `Chat Styles: ${Object.entries(stats.userStyles)
      .map(([style, count]) => `${style}(${count})`)
      .join(', ')}`,
  ].join(' | ');
  client.say(channel, `📊 ${insights}`);
}

export { initBot };
