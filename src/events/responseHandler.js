import logger from '../utils/logger.js';
import { generateResponse } from '../utils/perplexity.js';
import spotify from '../spotify/spotify.js';

export async function handleMessage(twitchClient, channel, tags, message) {
  // Handle Spotify commands
  if (message.startsWith('!nowplaying')) {
    const track = await spotify.getCurrentTrack();
    if (track) {
      twitchClient.say(channel, `🎵 Now Playing: ${track.name} by ${track.artist}`);
    } else {
      twitchClient.say(channel, 'No track is currently playing.');
    }
    return;
  }

  if (message.startsWith('!request') || message.startsWith('!songrequest')) {
    const command = message.startsWith('!request') ? '!request' : '!songrequest';
    const query = message.slice(command.length).trim();
    if (!query) {
      twitchClient.say(channel, 'Please specify a song to request!');
      return;
    }

    const track = await spotify.searchTrack(query);
    if (!track) {
      twitchClient.say(channel, 'Could not find that song.');
      return;
    }

    if (track.error) {
      twitchClient.say(channel, track.message);
      return;
    }

    const success = await spotify.addToQueue(track.uri);
    if (success) {
      twitchClient.say(channel, `🎵 Added to queue: ${track.name} by ${track.artists[0].name}`);
    } else {
      twitchClient.say(channel, 'Failed to add song to queue.');
    }
    return;
  }

  if (message.startsWith('!queue')) {
    const queue = spotify.getQueue();
    if (queue.length === 0) {
      twitchClient.say(channel, 'The queue is empty.');
    } else {
      twitchClient.say(channel, `🎵 Queue: ${queue.length} songs`);
    }
    return;
  }

  if (message.trim().toLowerCase().startsWith('!commands')) {
    const commands = [
      '!nowplaying - Shows the currently playing track',
      '!request <song/artist> - Request a song by name, artist, or both to be added to the queue',
      '!queue - Shows the current queue status',
      '!commands - Lists all available commands',
    ];
    twitchClient.say(channel, `🔥🐷 Available commands: ${commands.join(' | ')} 🔥🐷`);
    return;
  }

  // AI-generated responses to keep chat engaging
  try {
    const response = await generateResponse(message);
    if (response) {
      twitchClient.say(channel, response);
      logger.info(`Responded to ${tags.username}: ${response}`);
    }
  } catch (error) {
    logger.error('Error generating AI response:', error);
  }
}

export async function handleFollow(twitchClient, channel, username) {
  try {
    const response = await generateResponse(`New follower: ${username}`);
    if (response) {
      twitchClient.say(channel, response);
      logger.info(`Responded to follow from ${username}: ${response}`);
    }
  } catch (error) {
    logger.error('Error handling follow:', error);
  }
}

export async function handleSub(twitchClient, channel, username, method, message) {
  try {
    const response = await generateResponse(
      `New sub: ${username}${message ? ` saying: ${message}` : ''}`
    );
    if (response) {
      twitchClient.say(channel, response);
      logger.info(`Responded to sub from ${username} using ${method}: ${response}`);
    }
  } catch (error) {
    logger.error('Error handling sub:', error);
  }
}

export async function handleRaid(twitchClient, channel, username, viewers) {
  try {
    const response = await generateResponse(`Raid from ${username} with ${viewers} viewers`);
    if (response) {
      twitchClient.say(channel, response);
      logger.info(`Responded to raid from ${username} with ${viewers} viewers: ${response}`);
    }
  } catch (error) {
    logger.error('Error handling raid:', error);
  }
}

export async function generateCheekyResponse(username, eventType, eventData) {
  // Wait for any potential async operations
  await new Promise((resolve) => setTimeout(resolve, 100));

  const baseResponses = {
    sub: [
      `🔥🐷 ${username} just subscribed${eventData?.method ? ` with ${eventData.method}` : ''}! Oink oink! 🔥🐷`,
      `🔥🐷 ${username} joined the pig pen${eventData?.message ? ` saying "${eventData.message}"` : ''}! 🔥🐷`,
      `🔥🐷 ${username} is now part of the fire pig family! 🔥🐷`,
    ],
    resub: [
      `🔥🐷 ${username} is back for ${eventData?.months || 'another'} month${eventData?.months > 1 ? 's' : ''}! Oink oink! 🔥🐷`,
      `🔥🐷 ${username} keeps the fire burning${eventData?.message ? ` and says "${eventData.message}"` : ''}! 🔥🐷`,
      `🔥🐷 ${username} is still here roasting with us! 🔥🐷`,
    ],
    raid: [
      `🔥🐷 ${username} is raiding with ${eventData?.viewers || 'an army of'} viewer${eventData?.viewers !== 1 ? 's' : ''}! Oink oink! 🔥🐷`,
      `🔥🐷 ${username} brought the heat with ${eventData?.viewers || 'their'} raiders! 🔥🐷`,
      `🔥🐷 ${username} is here to roast with us! Welcome raiders! 🔥🐷`,
    ],
    follow: [
      `🔥🐷 ${username} just followed! Oink oink! 🔥🐷`,
      `🔥🐷 ${username} joined the fire pig squad! 🔥🐷`,
      `🔥🐷 ${username} is now part of the pig pen! 🔥🐷`,
    ],
  };

  const responses = baseResponses[eventType];
  if (!responses) {
    logger.warn(`Unknown event type: ${eventType}`);
    return `🔥🐷 Thanks for the support, ${username}! 🔥🐷`;
  }

  const randomIndex = Math.floor(Math.random() * responses.length);
  return responses[randomIndex];
}
