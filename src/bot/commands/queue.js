import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import logger from '../../utils/logger.js';
import spotify from '../../spotify/spotify.js';
import tokenManager from '../../auth/tokenManager.js';

// Queue command handlers
export async function handleListQueue() {
  try {
    const status = await spotify.getQueueStatus();
    return {
      success: true,
      message: status,
    };
  } catch (error) {
    logger.error('Error getting queue status:', error);
    return {
      success: false,
      message: 'Error getting queue status. Please try again.',
    };
  }
}

export async function handleClearQueue(username) {
  try {
    const result = await spotify.clearQueue();
    return {
      success: true,
      message: result,
    };
  } catch (error) {
    logger.error('Error clearing queue:', error);
    return {
      success: false,
      message: 'Error clearing queue. Please try again.',
    };
  }
}

export async function handleRemoveFromQueue(username, index) {
  try {
    const result = await spotify.removeSong(index, username);
    return {
      success: true,
      message: result,
    };
  } catch (error) {
    logger.error('Error removing song from queue:', error);
    return {
      success: false,
      message: 'Error removing song from queue. Please try again.',
    };
  }
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
