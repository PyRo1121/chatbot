import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import logger from '../../utils/logger.js';
import spotify from '../../spotify/spotify.js';
import tokenManager from '../../auth/tokenManager.js';

// Initialize song queue
const songQueue = [];

// Helper function for retrying operations
function retryOperation(operation, maxAttempts = 3, baseDelay = 1000) {
  const attempt = async (attemptNumber) => {
    try {
      return await operation();
    } catch (error) {
      if (attemptNumber >= maxAttempts) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attemptNumber - 1);
      logger.info(`Attempt ${attemptNumber} failed, retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return attempt(attemptNumber + 1);
    }
  };

  return attempt(1);
}

// Queue file operations
function ensureQueueFile() {
  const queueFilePath = join(process.cwd(), 'src/spotify/song_queue.json');
  if (!existsSync(queueFilePath)) {
    try {
      writeFileSync(queueFilePath, JSON.stringify([], null, 2));
      logger.info('Created new song queue file');
    } catch (error) {
      logger.error('Error creating song queue file:', error);
    }
  }
}

function loadSongQueue() {
  try {
    const queueFilePath = join(process.cwd(), 'src/spotify/song_queue.json');
    const data = readFileSync(queueFilePath, 'utf8');
    const parsedQueue = JSON.parse(data);
    const loadedQueue = Array.isArray(parsedQueue) ? parsedQueue : [];
    songQueue.length = 0;
    songQueue.push(...loadedQueue);
    logger.info(`Loaded existing song queue with ${songQueue.length} items`);
  } catch (error) {
    logger.error('Error loading song queue:', error);
    songQueue.length = 0;
  }
}

function saveSongQueue() {
  try {
    const queueFilePath = join(process.cwd(), 'src/spotify/song_queue.json');
    writeFileSync(queueFilePath, JSON.stringify(songQueue, null, 2));
    logger.info(`Saved song queue with ${songQueue.length} items`);
  } catch (error) {
    logger.error('Error saving song queue:', error);
  }
}

// Queue command handlers
export function handleListQueue() {
  if (songQueue.length === 0) {
    return {
      success: true,
      message: 'The song queue is currently empty! 🎵',
    };
  }

  const queueList = songQueue
    .map((song, index) => `${index + 1}. "${song.songName}" requested by ${song.username}`)
    .join(' | ');

  return {
    success: true,
    message: `Current Queue: ${queueList}`,
  };
}

export function handleClearQueue(username) {
  songQueue.length = 0;
  saveSongQueue();
  return {
    success: true,
    message: `🔥🐷 Queue cleared by ${username}!`,
  };
}

export function handleRemoveFromQueue(username, index) {
  if (!index || isNaN(index)) {
    return {
      success: false,
      message: 'Usage: !queueremove [position number]',
    };
  }

  if (index < 1 || index > songQueue.length) {
    return {
      success: false,
      message: `Invalid queue position. Queue has ${songQueue.length} items.`,
    };
  }

  const [removedSong] = songQueue.splice(index - 1, 1);
  saveSongQueue();
  return {
    success: true,
    message: `🔥🐷 Removed "${removedSong.songName}" requested by ${removedSong.username}`,
  };
}

export async function handleSongRequest(username, songName, twitchClient) {
  if (!songName || songName.trim().length === 0) {
    return {
      success: false,
      message: `Sorry, ${username}, please provide a valid song name.`,
    };
  }

  try {
    const cleanSongName = songName
      .trim()
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-'",.!?]/g, '');

    if (cleanSongName.length === 0) {
      return {
        success: false,
        message: `Sorry, ${username}, please provide a valid song name.`,
      };
    }

    const normalizedSongName = cleanSongName.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const isDuplicate = songQueue.some((song) => {
      const existingNormalized = song.songName.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      return existingNormalized === normalizedSongName;
    });

    if (isDuplicate) {
      return {
        success: false,
        message: `Sorry, ${username}, "${cleanSongName}" is already in the queue.`,
      };
    }

    const song = {
      username,
      songName: cleanSongName,
      timestamp: Date.now(),
    };
    songQueue.push(song);
    saveSongQueue();

    // Process queue immediately after adding a song
    // Send immediate feedback
    const initialResponse = {
      success: true,
      message: `🔥🐷 Checking song "${cleanSongName}" for ${username}... please wait!`,
      queueData: songQueue,
    };

    // Process queue asynchronously
    // Get channel from tokenManager
    const channel = `#${(await tokenManager.getBroadcasterTokens()).channel}`;
    processSongQueue()
      .then((processResult) => {
        if (processResult && !processResult.success) {
          twitchClient.client.say(
            channel,
            `❌ Sorry, couldn't add "${cleanSongName}": ${processResult.message}`
          );
        } else {
          twitchClient.client.say(
            channel,
            `✅ Successfully added "${cleanSongName}" to the queue!`
          );
        }
      })
      .catch((error) => {
        logger.error('Error in song queue processing:', error);
      });

    return initialResponse;
  } catch (error) {
    logger.error('Error handling song request:', error);
    return {
      success: false,
      message: `Sorry, ${username}, there was an issue adding your song.`,
    };
  }
}

export async function processSongQueue() {
  if (songQueue.length === 0) {
    logger.debug('Song queue is empty - nothing to process');
    return;
  }

  try {
    const [song] = songQueue;
    logger.info(`Processing song request: ${song.songName} from ${song.username}`);
    logger.debug('Current queue state:', songQueue);

    logger.debug(`Initiating Spotify search for: "${song.songName}"`);
    const track = await spotify.searchTrack(song.songName);
    logger.info(`Track search result for "${song.songName}":`, {
      found: !!track,
      error: track?.error,
      uri: track?.uri,
      name: track?.name,
    });

    if (track && !track.error) {
      logger.info(`Found track: ${track.name} (${track.uri})`);
      logger.debug('Attempting to add track to Spotify queue');

      const devices = await retryOperation(async () => {
        const deviceList = await spotify.api.getMyDevices();
        if (!deviceList.body.devices?.length) {
          throw new Error('No Spotify devices found');
        }
        return deviceList;
      });

      const activeDevice = devices.body.devices.find((d) => d.is_active);
      if (!activeDevice) {
        logger.info('No active Spotify device - attempting to activate');
        const [firstDevice] = devices.body.devices;
        if (firstDevice) {
          await spotify.api.transferMyPlayback([firstDevice.id], { play: false });
          logger.info(`Transferred playback to device: ${firstDevice.name}`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      const queueResult = await retryOperation(async () => {
        const result = await spotify.addToQueue(track.uri);
        if (!result.success) {
          throw new Error(result.error || 'Failed to add to queue');
        }
        return result;
      });

      if (queueResult.success) {
        songQueue.shift();
        saveSongQueue();
        return {
          success: true,
          message: `🎵 Now adding "${song.songName}" requested by ${song.username} to Spotify queue!`,
        };
      }
      logger.error(`Failed to add "${song.songName}" to Spotify queue`);
      songQueue.push(songQueue.shift());
      saveSongQueue();
      return {
        success: false,
        message: `❌ Could not add "${song.songName}" to Spotify queue. Please try again later.`,
      };
    }
    const errorMessage = track?.message || 'Could not find the track';
    logger.error(`Track search error for "${song.songName}": ${errorMessage}`);
    songQueue.push(songQueue.shift());
    saveSongQueue();
    return {
      success: false,
      message: `❌ ${errorMessage}`,
    };
  } catch (error) {
    logger.error('Comprehensive error processing song queue:', error);
    if (songQueue.length > 0) {
      songQueue.push(songQueue.shift());
      saveSongQueue();
    }
    return {
      success: false,
      message: 'An error occurred while processing the song queue.',
    };
  }
}

// Initialize queue
ensureQueueFile();
loadSongQueue();

export { songQueue };
