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
  // Reload queue from file to ensure we have latest data
  loadSongQueue();
  
  // Get Spotify's queue state
  const spotifyQueue = spotify.getQueue();
  
  // Read our local queue file
  const queueFilePath = join(process.cwd(), 'src/spotify/song_queue.json');
  try {
    const queueData = JSON.parse(readFileSync(queueFilePath, 'utf8'));
    
    // If both queues are empty
    if ((!Array.isArray(queueData) || queueData.length === 0) && spotifyQueue.length === 0) {
      return {
        success: true,
        message: 'The song queue is currently empty! 🎵',
      };
    }

    // Combine and deduplicate queues
    const combinedQueue = [...queueData];
    spotifyQueue.forEach(spotifyTrack => {
      if (!combinedQueue.some(song => song.uri === spotifyTrack)) {
        combinedQueue.push({
          songName: "Unknown Song",
          username: "System",
          uri: spotifyTrack,
          timestamp: Date.now()
        });
      }
    });

    // Update our local queue file with combined state
    writeFileSync(queueFilePath, JSON.stringify(combinedQueue, null, 2));

    const queueList = combinedQueue
      .map((song, index) => `${index + 1}. "${song.songName}" requested by ${song.username}`)
      .join('\n');

    return {
      success: true,
      message: `Current Queue:\n${queueList}`,
    };
  } catch (error) {
    logger.error('Error reading queue file:', error);
    return {
      success: true,
      message: 'The song queue is currently empty! 🎵',
    };
  }
}

export function handleClearQueue(username) {
  loadSongQueue(); // Ensure we have latest state before clearing
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

  loadSongQueue(); // Ensure we have latest state before removing
  
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
    // Reload queue before processing new request
    loadSongQueue();
    
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

    // Search for the track first to get its URI
    const track = await spotify.searchTrack(cleanSongName);
    if (!track || track.error) {
      return {
        success: false,
        message: track?.message || `Sorry, ${username}, couldn't find that song.`,
      };
    }

    const song = {
      username,
      songName: track.name || cleanSongName,
      timestamp: Date.now(),
      uri: track.uri,
      artist: track.artists?.[0]?.name || 'Unknown Artist'
    };
    songQueue.push(song);
    saveSongQueue();

    // Add to Spotify queue directly
    const queueResult = await spotify.addToQueue(track.uri);
    if (!queueResult.success) {
      songQueue.pop(); // Remove from our queue if Spotify add failed
      saveSongQueue();
      return {
        success: false,
        message: `❌ Sorry, couldn't add "${track.name}": ${queueResult.error || 'Unknown error'}`,
      };
    }

    // Successfully added to both queues
    return {
      success: true,
      message: `✅ Successfully added "${track.name}" by ${track.artists?.[0]?.name || 'Unknown Artist'} to the queue!`,
      queueData: songQueue,
    };
  } catch (error) {
    logger.error('Error handling song request:', error);
    return {
      success: false,
      message: `Sorry, ${username}, there was an issue adding your song.`,
    };
  }
}

// Helper function to sync queue state
async function syncQueueState() {
  try {
    const spotifyQueue = spotify.getQueue();
    const localQueue = songQueue.filter(song => song.uri && spotifyQueue.includes(song.uri));
    songQueue.length = 0;
    songQueue.push(...localQueue);
    saveSongQueue();
    logger.info('Queue state synchronized with Spotify');
  } catch (error) {
    logger.error('Error syncing queue state:', error);
  }
}

// Set up periodic queue sync
setInterval(syncQueueState, 30000); // Sync every 30 seconds

// Initialize queue
ensureQueueFile();
loadSongQueue();

export { songQueue };
