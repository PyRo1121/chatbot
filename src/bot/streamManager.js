import { ApiClient } from '@twurple/api';
import { RefreshingAuthProvider } from '@twurple/auth';
import tokenManager from '../auth/tokenManager.js';
import fs from 'fs/promises';
import path from 'path';

const STREAM_DATA_FILE = path.join(process.cwd(), 'src/bot/stream_data.json');
let streamStartTime = null;
let milestones = [];

// Initialize stream data storage
async function initStreamData() {
  try {
    await fs.access(STREAM_DATA_FILE);
  } catch {
    await fs.writeFile(
      STREAM_DATA_FILE,
      JSON.stringify({
        milestones: [],
        categories: [],
        streamHistory: [],
      })
    );
  }
}

// Load stream data
async function loadStreamData() {
  try {
    const data = await fs.readFile(STREAM_DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading stream data:', error);
    return { milestones: [], categories: [], streamHistory: [] };
  }
}

// Save stream data
async function saveStreamData(data) {
  try {
    await fs.writeFile(STREAM_DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving stream data:', error);
  }
}

// Update stream information
async function updateStreamInfo(channel, title, category) {
  try {
    const tokens = await tokenManager.getBroadcasterTokens();

    const authProvider = new RefreshingAuthProvider({
      clientId: tokens.clientId,
      clientSecret: tokens.clientSecret,
      onRefresh: async (userId, newTokenData) => {
        await tokenManager.updateBroadcasterTokens(newTokenData);
      },
    });

    await authProvider.addUserForToken({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: 0,
      obtainmentTimestamp: 0,
    });

    const apiClient = new ApiClient({ authProvider });

    await apiClient.channels.updateChannelInfo(channel.id, {
      title,
      gameId: category,
    });

    const streamData = await loadStreamData();
    streamData.categories.push({
      timestamp: new Date().toISOString(),
      title,
      category,
    });
    await saveStreamData(streamData);

    return true;
  } catch (error) {
    console.error('Error updating stream info:', error);
    return false;
  }
}

// Track stream uptime and milestones
function getStreamUptime() {
  if (!streamStartTime) {
    return 'Stream is offline';
  }
  const uptime = Date.now() - streamStartTime;
  const hours = Math.floor(uptime / (1000 * 60 * 60));
  const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

// Add stream milestone
async function addMilestone(milestone) {
  const streamData = await loadStreamData();
  streamData.milestones.push({
    timestamp: new Date().toISOString(),
    description: milestone,
    uptime: getStreamUptime(),
  });
  await saveStreamData(streamData);
}

// Stream commands
export const streamCommands = {
  title: async (client, channel, user, message) => {
    if (!message.trim()) {
      return 'Please provide a new title for the stream';
    }
    const success = await updateStreamInfo(channel, message.trim(), null);
    return success ? 'Stream title updated!' : 'Failed to update stream title';
  },

  category: async (client, channel, user, message) => {
    if (!message.trim()) {
      return 'Please provide a category/game name';
    }
    const success = await updateStreamInfo(channel, null, message.trim());
    return success ? 'Stream category updated!' : 'Failed to update stream category';
  },

  uptime: () => getStreamUptime(),

  milestone: async (client, channel, user, message) => {
    if (!message.trim()) {
      return 'Please provide a milestone description';
    }
    await addMilestone(message.trim());
    return 'Milestone added!';
  },
};

// Stream event handlers
export const streamEventHandlers = {
  onStreamStart: () => {
    streamStartTime = Date.now();
  },

  onStreamEnd: async () => {
    if (streamStartTime) {
      const streamData = await loadStreamData();
      streamData.streamHistory.push({
        startTime: new Date(streamStartTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: getStreamUptime(),
        milestones,
      });
      await saveStreamData(streamData);
      streamStartTime = null;
      milestones = [];
    }
  },
};

// Initialize stream data on module load
initStreamData();
