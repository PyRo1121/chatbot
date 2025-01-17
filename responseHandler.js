import logger from './utils/logger.js';
import { generateResponse } from './openai.js';
import { client } from './bot.js';
import spotify from './spotify.js';

export async function handleMessage(channel, tags, message) {
  // Handle Spotify commands
  if (message.startsWith('!nowplaying')) {
    const track = await spotify.getCurrentTrack();
    if (track) {
      client.say(channel, `🎵 Now Playing: ${track.name} by ${track.artist}`);
    } else {
      client.say(channel, 'No track is currently playing.');
    }
    return;
  }

  if (message.startsWith('!request') || message.startsWith('!songrequest')) {
    const command = message.startsWith('!request') ? '!request' : '!songrequest';
    const query = message.slice(command.length).trim();
    if (!query) {
      client.say(channel, 'Please specify a song to request!');
      return;
    }

    const track = await spotify.searchTrack(query);
    if (!track) {
      client.say(channel, 'Could not find that song.');
      return;
    }
    
    if (track.error) {
      client.say(channel, track.message);
      return;
    }

    const success = await spotify.addToQueue(track.uri);
    if (success) {
      client.say(channel, `🎵 Added to queue: ${track.name} by ${track.artists[0].name}`);
    } else {
      client.say(channel, 'Failed to add song to queue.');
    }
    return;
  }

  if (message.startsWith('!queue')) {
    const queue = spotify.getQueue();
    if (queue.length === 0) {
      client.say(channel, 'The queue is empty.');
    } else {
      client.say(channel, `🎵 Queue: ${queue.length} songs`);
    }
    return;
  }

  if (message.trim().toLowerCase().startsWith('!commands')) {
    const commands = [
      '!nowplaying - Shows the currently playing track',
      '!request <song/artist> - Request a song by name, artist, or both to be added to the queue',
      '!queue - Shows the current queue status',
      '!commands - Lists all available commands'
    ];
    client.say(channel, '🔥🐷 Available commands: ' + commands.join(' | ') + ' 🔥🐷');
    return;
  }

  // AI-generated responses to keep chat engaging
  try {
    const response = await generateResponse(message);
    if (response) {
      client.say(channel, response);
      logger.info(`Responded to ${tags.username}: ${response}`);
    }
  } catch (error) {
    logger.error('Error generating AI response:', error);
  }
}

export async function handleFollow(client, channel, username) {
  try {
    const response = await generateResponse(`New follower: ${username}`);
    if (response) {
      client.say(channel, response);
      logger.info(`Responded to follow from ${username}: ${response}`);
    }
  } catch (error) {
    logger.error('Error handling follow:', error);
  }
}

export async function handleSub(client, channel, username, method, message) {
  try {
    const response = await generateResponse(`New sub: ${username}`);
    if (response) {
      client.say(channel, response);
      logger.info(`Responded to sub from ${username}: ${response}`);
    }
  } catch (error) {
    logger.error('Error handling sub:', error);
  }
}

export async function handleRaid(client, channel, username, viewers) {
  try {
    const response = await generateResponse(`Raid from ${username} with ${viewers} viewers`);
    if (response) {
      client.say(channel, response);
      logger.info(`Responded to raid from ${username}: ${response}`);
    }
  } catch (error) {
    logger.error('Error handling raid:', error);
  }
}

export async function generateCheekyResponse(username, eventType) {
  const responses = {
    sub: [
      `🔥🐷 ${username} just subscribed! Oink oink! 🔥🐷`,
      `🔥🐷 ${username} joined the pig pen! 🔥🐷`,
      `🔥🐷 ${username} is now part of the fire pig family! 🔥🐷`
    ],
    resub: [
      `🔥🐷 ${username} is back for more! Oink oink! 🔥🐷`,
      `🔥🐷 ${username} keeps the fire burning! 🔥🐷`,
      `🔥🐷 ${username} is still here roasting with us! 🔥🐷`
    ],
    raid: [
      `🔥🐷 ${username} is raiding with an army! Oink oink! 🔥🐷`,
      `🔥🐷 ${username} brought the heat! 🔥🐷`,
      `🔥🐷 ${username} is here to roast with us! 🔥🐷`
    ],
    follow: [
      `🔥🐷 ${username} just followed! Oink oink! 🔥🐷`,
      `🔥🐷 ${username} joined the fire pig squad! 🔥🐷`,
      `🔥🐷 ${username} is now part of the pig pen! 🔥🐷`
    ]
  };

  const randomIndex = Math.floor(Math.random() * responses[eventType].length);
  return responses[eventType][randomIndex];
}
