import tmi from 'tmi.js';
import { renderTemplate, broadcastUpdate } from './overlays.js';
import logger from './utils/logger.js';
import spotify from './spotify.js';

// Initialize song queue at the top level
const songQueue = [];

import 'dotenv/config';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, unlinkSync, createReadStream } from 'fs';
import fetch from 'node-fetch';
import FormData from 'form-data';

// Format the OAuth token correctly (do this once at startup)
const authToken = process.env.TWITCH_OAUTH_TOKEN.startsWith('oauth:') 
  ? process.env.TWITCH_OAUTH_TOKEN.substring(6) 
  : process.env.TWITCH_OAUTH_TOKEN;

// Create and export the client
const client = createClient();
setupSongQueueProcessing(client);
export { client };


// Ensure queue file exists and is valid
function ensureQueueFile() {
  const queueFilePath = join(process.cwd(), 'song_queue.json');
  
  // Create file if it doesn't exist
  if (!existsSync(queueFilePath)) {
    try {
      writeFileSync(queueFilePath, JSON.stringify([], null, 2));
      logger.info('Created new song queue file');
    } catch (error) {
      logger.error('Error creating song queue file:', error);
    }
  }
}

// Load song queue from file
function loadSongQueue() {
  try {
    const queueFilePath = join(process.cwd(), 'song_queue.json');
    const data = readFileSync(queueFilePath, 'utf8');
    
    // Validate JSON
    const parsedQueue = JSON.parse(data);
    
    // Ensure it's an array and update the queue
    const loadedQueue = Array.isArray(parsedQueue) ? parsedQueue : [];
    songQueue.length = 0;
    songQueue.push(...loadedQueue);
    
    logger.info(`Loaded existing song queue with ${songQueue.length} items`);
  } catch (error) {
    logger.error('Error loading song queue:', error);
    songQueue.length = 0; // Clear the queue if there's an error
  }
}

// Save song queue to file
function saveSongQueue() {
  try {
    const queueFilePath = join(process.cwd(), 'song_queue.json');
    writeFileSync(queueFilePath, JSON.stringify(songQueue, null, 2));
    logger.info(`Saved song queue with ${songQueue.length} items`);
  } catch (error) {
    logger.error('Error saving song queue:', error);
  }
}

// Ensure queue file exists on startup
ensureQueueFile();
loadSongQueue();

// Track emote usage
function countEmotes(message, tags) {
  let count = 0;
  if (tags.emotes) {
    Object.values(tags.emotes).forEach(positions => {
      count += positions.length;
    });
  }
  return count;
}

// Global variables for stream and chat tracking
let lastChatMessages = []; // Store recent messages for context
const CHAT_MEMORY_SIZE = 20; // Number of messages to keep for context
const CLIP_COOLDOWN = 5 * 60 * 1000; // 5 minutes between auto-clips
let lastClipTime = 0;
const STREAM_ANALYSIS_INTERVAL = 10 * 1000; // Check stream every 10 seconds
let lastStreamAnalysis = 0;

// Clip detection function
async function analyzeStreamMoment(messages, emoteCount) {
  try {
    // Basic clip detection logic
    // Look for high emote count or multiple excited messages
    const excitedMessages = messages.filter(m => 
      emoteCount > 5 || 
      (m.message.includes('!') && m.message.toLowerCase().includes('omg')) ||
      (m.message.toLowerCase().includes('wow') && m.message.toLowerCase().includes('epic'))
    );

    // If more than 3 excited messages in recent context, consider it a clip-worthy moment
    return excitedMessages.length >= 3;
  } catch (error) {
    logger.error('Error analyzing stream moment:', error);
    return false;
  }
}

// Clip creation function
async function createClip(channel) {
  try {
    // Simulate clip creation 
    const clipId = Math.random().toString(36).substring(7);
    const clipUrl = `https://clips.twitch.tv/${clipId}`;

    logger.info(`Simulated clip created: ${clipUrl}`);

    return {
      id: clipId,
      url: clipUrl,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Error creating clip:', error);
    return null;
  }
}

// Song request handling
async function handleSongRequest(username, songName) {
  try {
    // Validate song name
    if (!songName || songName.trim().length === 0) {
      return `Sorry, ${username}, please provide a valid song name.`;
    }

    // Clean and normalize song name
    const cleanSongName = songName
      .trim()
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width chars
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s\-'",.!?]/g, ''); // Remove special chars except basic punctuation
    
    // Check if cleaned name is empty
    if (cleanSongName.length === 0) {
      return `Sorry, ${username}, please provide a valid song name.`;
    }

    // Normalize for duplicate checking
    const normalizedSongName = cleanSongName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ''); // Remove punctuation for comparison

    // Check for duplicate song request
    const isDuplicate = songQueue.some(song => {
      const existingNormalized = song.songName
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '');
      return existingNormalized === normalizedSongName;
    });

    if (isDuplicate) {
      return `Sorry, ${username}, "${cleanSongName}" is already in the queue.`;
    }

    // Add song to queue
    const song = { 
      username, 
      songName: cleanSongName,
      timestamp: Date.now()
    };
    songQueue.push(song);
    
    // Save updated queue
    saveSongQueue();

    return `🔥🐷 Added "${cleanSongName}" to the queue for ${username}!`;
  } catch (error) {
    logger.error('Error handling song request:', error);
    return `Sorry, ${username}, there was an issue adding your song.`;
  }
}

// Queue management functions
function listQueue(channel, client) {
  if (songQueue.length === 0) {
    client.say(channel, "The song queue is currently empty! 🎵");
    return;
  }

  const queueList = songQueue.map((song, index) => 
    `${index + 1}. "${song.songName}" requested by ${song.username}`
  ).join(' | ');

  client.say(channel, `Current Queue: ${queueList}`);
}

function clearQueue(username, channel, client) {
  songQueue.length = 0;
  saveSongQueue();
  client.say(channel, `🔥🐷 Queue cleared by ${username}!`);
}

function removeFromQueue(username, index, channel, client) {
  if (index < 1 || index > songQueue.length) {
    client.say(channel, `Invalid queue position. Queue has ${songQueue.length} items.`);
    return;
  }

  const removedSong = songQueue.splice(index - 1, 1)[0];
  saveSongQueue();
  client.say(channel, `🔥🐷 Removed "${removedSong.songName}" requested by ${removedSong.username}`);
}

// Process song queue and add to Spotify
async function processSongQueue(channel, client) {
  if (songQueue.length === 0) {
    logger.debug('Song queue is empty - nothing to process');
    return;
  }

  try {
    const song = songQueue[0];
    logger.info(`Processing song request: ${song.songName} from ${song.username}`);
    logger.debug('Current queue state:', songQueue);

    // Enhanced logging for track search
    logger.debug(`Initiating Spotify search for: "${song.songName}"`);
    const track = await spotify.searchTrack(song.songName);
    logger.info(`Track search result for "${song.songName}":`, {
      found: !!track,
      error: track?.error,
      uri: track?.uri,
      name: track?.name
    });

    if (track && !track.error) {
      logger.info(`Found track: ${track.name} (${track.uri})`);
      logger.debug('Attempting to add track to Spotify queue');
      
      // Try adding to queue up to 5 times with increasing delays
      let addedToQueue = false;
      let attempts = 0;
      const maxAttempts = 5;
      const baseDelay = 2000; // Start with 2 second delay
      
      while (!addedToQueue && attempts < maxAttempts) {
        attempts++;
        try {
      // Get current device status with retry logic
      let devices;
      let deviceAttempts = 0;
      const maxDeviceAttempts = 3;
      
      while (deviceAttempts < maxDeviceAttempts) {
        try {
          devices = await spotify.api.getMyDevices();
          logger.info('Available Spotify devices:', devices.body.devices);
          
          if (!devices.body.devices?.length) {
            throw new Error('No Spotify devices found');
          }
          
          // If no active device, try to activate one
          const activeDevice = devices.body.devices.find(d => d.is_active);
          if (!activeDevice) {
            logger.info('No active Spotify device - attempting to activate');
            const firstDevice = devices.body.devices[0];
            if (firstDevice) {
              await spotify.api.transferMyPlayback([firstDevice.id], { play: false });
              logger.info(`Transferred playback to device: ${firstDevice.name}`);
              await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for transfer
            }
          }
          break;
        } catch (error) {
          deviceAttempts++;
          logger.error(`Device detection attempt ${deviceAttempts} failed:`, error);
          if (deviceAttempts < maxDeviceAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            throw error;
          }
        }
      }

          const queueResult = await spotify.addToQueue(track.uri);
          addedToQueue = queueResult.success;
          
          if (addedToQueue) {
            // Remove the first song from the queue
            songQueue.shift();
            saveSongQueue();
            
            // Announce the song being added
            client.say(channel, `🎵 Now adding "${song.songName}" requested by ${song.username} to Spotify queue!`);
            return; // Exit after successful addition
          } else {
            logger.warn(`Attempt ${attempts} failed to add track to queue: ${queueResult.error}`);
            
            // Exponential backoff for retries
            const delay = baseDelay * Math.pow(2, attempts - 1);
            logger.info(`Waiting ${delay}ms before next attempt...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (error) {
          logger.error(`Error on attempt ${attempts}:`, error);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      logger.info(`Add to queue result: ${addedToQueue}`, {
        trackUri: track.uri,
        trackName: track.name,
        queuePosition: songQueue.length,
        attempts: attempts
      });
      
      if (addedToQueue) {
        // Remove the first song from the queue
        songQueue.shift();
        saveSongQueue();
        
        // Announce the song being added
        client.say(channel, `🎵 Now adding "${song.songName}" requested by ${song.username} to Spotify queue!`);
      } else {
        logger.error(`Failed to add "${song.songName}" to Spotify queue after ${maxAttempts} attempts`);
        client.say(channel, `❌ Could not add "${song.songName}" to Spotify queue. Please try again later.`);
        
        // Move problematic song to end of queue instead of removing
        songQueue.push(songQueue.shift());
        saveSongQueue();
      }
    } else {
      // If track search fails or is inappropriate
      const errorMessage = track?.message || "Could not find the track";
      logger.error(`Track search error for "${song.songName}": ${errorMessage}`);
      
      client.say(channel, `❌ ${errorMessage}`);
      
      // Move problematic song to end of queue instead of removing
      songQueue.push(songQueue.shift());
      saveSongQueue();
    }
  } catch (error) {
    logger.error('Comprehensive error processing song queue:', error);
    
    // Move problematic song to end of queue
    if (songQueue.length > 0) {
      songQueue.push(songQueue.shift());
      saveSongQueue();
    }
  }
}

// Immediate processing of song queue on startup and every 30 seconds
function setupSongQueueProcessing(client) {
  // Process queue immediately on startup
  if (client) {
    processSongQueue(process.env.TWITCH_CHANNEL, client);
  }

  // Set up interval to process song queue every 30 seconds
  setInterval(() => {
    if (client) {
      processSongQueue(process.env.TWITCH_CHANNEL, client);
    }
  }, 30000);
}

// Call this function after client is created

// Rest of the file remains the same as in the previous version...

// Create and configure Twitch client
function createClient() {
  const client = new tmi.Client({
    options: { debug: true },
    identity: {
      username: process.env.TWITCH_BOT_USERNAME,
      password: `oauth:${authToken}`,
      clientId: process.env.TWITCH_BOT_CLIENT_ID,
      clientSecret: process.env.TWITCH_BOT_CLIENT_SECRET
    },
    channels: [process.env.TWITCH_CHANNEL],
    connection: {
      secure: true,
      reconnect: true
    },
    api: {
      baseUrl: 'https://api.twitch.tv/helix',
      headers: {
        'Client-ID': process.env.TWITCH_BOT_CLIENT_ID,
        'Authorization': `Bearer ${authToken}`
      }
    }
  });

  // Setup message handler
  client.on('message', async (channel, tags, message, self) => {
    if (self) return;

    try {
      // Check for command
      if (message.startsWith('!')) {
        const command = message.split(' ')[0].toLowerCase();
        const args = message.split(' ').slice(1);

        switch (command) {
          case '!ping':
            client.say(channel, `Pong! 🔥🐷`);
            break;

          case '!commands':
            client.say(channel, `Available commands: !ping, !songrequest, !queue, !queueclear, !queueremove, !spotify, !so`);
            break;

          case '!songrequest':
            if (args.length > 0) {
              const songResponse = await handleSongRequest(tags.username, args.join(' '));
              client.say(channel, songResponse);
            } else {
              client.say(channel, `Usage: !songrequest [song name]`);
            }
            break;

          case '!queue':
            listQueue(channel, client);
            break;

          case '!queueclear':
            clearQueue(tags.username, channel, client);
            break;

          case '!queueremove':
            if (args.length > 0) {
              const index = parseInt(args[0], 10);
              removeFromQueue(tags.username, index, channel, client);
            } else {
              client.say(channel, `Usage: !queueremove [position number]`);
            }
            break;
        }
      }
    } catch (error) {
      logger.error('Error in message handler:', error);
    }
  });

  // Connect the client
  client.connect().catch(err => {
    logger.error('Failed to connect to Twitch:', err);
  });

  return client;
}

// Client is already created and exported above
