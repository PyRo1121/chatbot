import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import logger from '../../utils/logger.js';
import spotify from '../../spotify/spotify.js';
import tokenManager from '../../auth/tokenManager.js';

// Queue command handlers
export function handleListQueue() {
  return {
    success: true,
    message: spotify.getQueueStatus(),
  };
}

export function handleClearQueue(username) {
  return {
    success: true,
    message: spotify.clearQueue(),
  };
}

export function handleRemoveFromQueue(username, index) {
  return spotify.removeSong(index, username);
}

export async function handleSongRequest(username, songName, twitchClient) {
  if (!songName || songName.trim().length === 0) {
    return {
      success: false,
      message: `Sorry, ${username}, please provide a valid song name.`,
    };
  }

  try {
    const channel = `#${process.env.TWITCH_CHANNEL}`;
    twitchClient.client.say(
      channel,
      `🔥🐷 Checking song "${songName}" for ${username}... please wait!`
    );

    return {
      success: true,
      message: await spotify.handleSongRequest(songName, username),
    };
  } catch (error) {
    logger.error('Error handling song request:', error);
    return {
      success: false,
      message: `Sorry, ${username}, there was an issue adding your song.`,
    };
  }
}
