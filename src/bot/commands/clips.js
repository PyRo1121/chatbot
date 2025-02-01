<<<<<<< HEAD
import { ApiClient } from '@twurple/api';
import { RefreshingAuthProvider } from '@twurple/auth';
import tokenManager from '../../auth/tokenManager.js';
import fs from 'fs/promises';
import path from 'path';

const CLIPS_FILE = path.join(process.cwd(), 'src/bot/clips.json');
const CHAT_ACTIVITY_THRESHOLD = 10; // Messages per minute to trigger auto-clip
const CLIP_COOLDOWN = 60000; // 1 minute cooldown between auto-clips

let lastAutoClip = 0;
let chatActivity = [];

// Initialize clips storage
async function initClipsStorage() {
  try {
    await fs.access(CLIPS_FILE);
  } catch {
    await fs.writeFile(CLIPS_FILE, JSON.stringify({ clips: [], highlights: [] }));
  }
}

// Load clips data
async function loadClipsData() {
  try {
    const data = await fs.readFile(CLIPS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading clips data:', error);
    return { clips: [], highlights: [] };
  }
}

// Save clips data
async function saveClipsData(data) {
  try {
    await fs.writeFile(CLIPS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving clips data:', error);
  }
}

// Create a clip
async function createClip(client, channel, title = '') {
  try {
    const tokens = await tokenManager.getBroadcasterTokens();
    const authProvider = new RefreshingAuthProvider({
      clientId: tokens.clientId,
      clientSecret: tokens.clientSecret,
    });

    await authProvider.addUserForToken({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: 0,
      obtainmentTimestamp: 0,
    });

    const apiClient = new ApiClient({ authProvider });
    const clip = await apiClient.clips.createClip({ channelId: channel.id });

    const clipsData = await loadClipsData();
    clipsData.clips.push({
      id: clip.id,
      title: title || `Clip from ${new Date().toISOString()}`,
      timestamp: new Date().toISOString(),
      url: `https://clips.twitch.tv/${clip.id}`,
    });

    await saveClipsData(clipsData);
    return clip;
  } catch (error) {
    console.error('Error creating clip:', error);
    throw error;
  }
}

// Track chat activity for auto-clips
function trackChatActivity() {
  const now = Date.now();
  chatActivity.push(now);

  // Remove messages older than 1 minute
  chatActivity = chatActivity.filter((time) => now - time <= 60000);

  // Check if we should create an auto-clip
  if (chatActivity.length >= CHAT_ACTIVITY_THRESHOLD && now - lastAutoClip >= CLIP_COOLDOWN) {
    lastAutoClip = now;
    return true;
  }
  return false;
}

// Generate highlight reel data
async function generateHighlightReel(duration = 7) {
  // days
  const clipsData = await loadClipsData();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - duration);

  return clipsData.clips
    .filter((clip) => new Date(clip.timestamp) >= cutoff)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export const clipCommands = {
  clip: async (client, channel, user, message) => {
    try {
      const title = message.trim();
      const clip = await createClip(client, channel, title);
      return `Clip created! Watch it here: https://clips.twitch.tv/${clip.id}`;
    } catch (error) {
      return `Failed to create clip: ${error.message}`;
    }
  },

  highlights: async (client, channel, user, message) => {
    try {
      const days = parseInt(message) || 7;
      const highlights = await generateHighlightReel(days);

      if (highlights.length === 0) {
        return `No clips found from the last ${days} days.`;
      }

      const recentClips = highlights
        .slice(0, 3)
        .map((clip) => clip.url)
        .join(' | ');

      return `Recent highlights: ${recentClips} | Total clips: ${highlights.length}`;
    } catch (error) {
      return `Failed to get highlights: ${error.message}`;
    }
  },
};

// Initialize clips storage on module load
initClipsStorage();

export const handleChatActivity = async (client, channel) => {
  if (trackChatActivity()) {
    try {
      await createClip(client, channel, 'Auto-clip from high chat activity');
    } catch (error) {
      console.error('Failed to create auto-clip:', error);
    }
  }
};
=======
import { ApiClient } from '@twurple/api';
import { RefreshingAuthProvider } from '@twurple/auth';
import tokenManager from '../../auth/tokenManager.js';
import fs from 'fs/promises';
import path from 'path';

const CLIPS_FILE = path.join(process.cwd(), 'src/bot/clips.json');
const CHAT_ACTIVITY_THRESHOLD = 10; // Messages per minute to trigger auto-clip
const CLIP_COOLDOWN = 60000; // 1 minute cooldown between auto-clips

let lastAutoClip = 0;
let chatActivity = [];

// Initialize clips storage
async function initClipsStorage() {
  try {
    await fs.access(CLIPS_FILE);
  } catch {
    await fs.writeFile(CLIPS_FILE, JSON.stringify({ clips: [], highlights: [] }));
  }
}

// Load clips data
async function loadClipsData() {
  try {
    const data = await fs.readFile(CLIPS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading clips data:', error);
    return { clips: [], highlights: [] };
  }
}

// Save clips data
async function saveClipsData(data) {
  try {
    await fs.writeFile(CLIPS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving clips data:', error);
  }
}

// Create a clip
async function createClip(client, channel, title = '') {
  try {
    const tokens = await tokenManager.getBroadcasterTokens();
    const authProvider = new RefreshingAuthProvider({
      clientId: tokens.clientId,
      clientSecret: tokens.clientSecret,
    });

    await authProvider.addUserForToken({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: 0,
      obtainmentTimestamp: 0,
    });

    const apiClient = new ApiClient({ authProvider });
    const clip = await apiClient.clips.createClip({ channelId: channel.id });

    const clipsData = await loadClipsData();
    clipsData.clips.push({
      id: clip.id,
      title: title || `Clip from ${new Date().toISOString()}`,
      timestamp: new Date().toISOString(),
      url: `https://clips.twitch.tv/${clip.id}`,
    });

    await saveClipsData(clipsData);
    return clip;
  } catch (error) {
    console.error('Error creating clip:', error);
    throw error;
  }
}

// Track chat activity for auto-clips
function trackChatActivity() {
  const now = Date.now();
  chatActivity.push(now);

  // Remove messages older than 1 minute
  chatActivity = chatActivity.filter((time) => now - time <= 60000);

  // Check if we should create an auto-clip
  if (chatActivity.length >= CHAT_ACTIVITY_THRESHOLD && now - lastAutoClip >= CLIP_COOLDOWN) {
    lastAutoClip = now;
    return true;
  }
  return false;
}

// Generate highlight reel data
async function generateHighlightReel(duration = 7) {
  // days
  const clipsData = await loadClipsData();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - duration);

  return clipsData.clips
    .filter((clip) => new Date(clip.timestamp) >= cutoff)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export const clipCommands = {
  clip: async (client, channel, user, message) => {
    try {
      const title = message.trim();
      const clip = await createClip(client, channel, title);
      return `Clip created! Watch it here: https://clips.twitch.tv/${clip.id}`;
    } catch (error) {
      return `Failed to create clip: ${error.message}`;
    }
  },

  highlights: async (client, channel, user, message) => {
    try {
      const days = parseInt(message) || 7;
      const highlights = await generateHighlightReel(days);

      if (highlights.length === 0) {
        return `No clips found from the last ${days} days.`;
      }

      const recentClips = highlights
        .slice(0, 3)
        .map((clip) => clip.url)
        .join(' | ');

      return `Recent highlights: ${recentClips} | Total clips: ${highlights.length}`;
    } catch (error) {
      return `Failed to get highlights: ${error.message}`;
    }
  },
};

// Initialize clips storage on module load
initClipsStorage();

export const handleChatActivity = async (client, channel) => {
  if (trackChatActivity()) {
    try {
      await createClip(client, channel, 'Auto-clip from high chat activity');
    } catch (error) {
      console.error('Failed to create auto-clip:', error);
    }
  }
};
>>>>>>> origin/master
