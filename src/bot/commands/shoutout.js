import { generateResponse } from '../../utils/gemini.js';
import logger from '../../utils/logger.js';
import { viewerManager } from '../viewerManager.js';

// Cache for storing channel info to reduce API calls
const channelCache = new Map();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

/**
 * Get cached channel info or fetch fresh data
 * @param {Object} twitchClient - Twitch client instance
 * @param {string} username - Target username
 * @returns {Promise<Object|null>} Channel info object
 */
async function getChannelInfo(twitchClient, username) {
  const cached = channelCache.get(username);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const data = await twitchClient.apiClient.users.getUserByName(username);
  if (data) {
    channelCache.set(username, {
      timestamp: Date.now(),
      data,
    });
  }
  return data;
}

/**
 * Validate and clean username input
 * @param {string} username - Raw username input
 * @returns {string} Cleaned username
 * @throws {Error} If username is invalid
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    throw new Error('Invalid username');
  }
  // Only remove @ and whitespace, preserve underscores and other valid Twitch username characters
  return username.replace(/^@+/, '').trim();
}

/**
 * Generate fallback shoutout message
 * @param {string} username - Target username
 * @returns {string} Fallback shoutout message
 */
function getFallbackMessage(username) {
  return `Hey everyone! Check out @${username} over at twitch.tv/${username}! They're awesome! 🎮`;
}

/**
 * Generate Gemini prompt for shoutout
 * @param {Object} channelData - Channel info object
 * @returns {string} Formatted prompt for Gemini
 */
function createShoutoutPrompt(channelData) {
  return `Generate a single Twitch shoutout message. Be natural and friendly.

Streamer Info:
- Name: ${channelData.displayName}
- Game: ${channelData.currentGame || channelData.lastGame || 'various games'}
- Status: ${channelData.isLive ? '🔴 Currently Live!' : 'Last seen playing'}
${channelData.title ? `- Stream: ${channelData.title}` : ''}

Rules:
1. Write ONE natural message (200-300 chars)
2. Use 1-2 gaming emojis (🎮 🎲 🏆 etc)
3. Must include: twitch.tv/${channelData.name}
4. Be enthusiastic but not overly promotional
5. Focus on their current/recent activity

DO NOT:
- Include these instructions
- Use placeholder text
- Exceed 300 characters
- Format as a list`;
}

/**
 * Handle !shoutout command - Generate a personalized shoutout message
 * @param {Object} twitchClient - Twitch client instance
 * @param {string} channel - Channel name
 * @param {Object} user - User object
 * @param {Array<string>} args - Command arguments
 * @returns {Promise<string>} Generated shoutout message
 */
export async function handleShoutout(twitchClient, channel, user, args) {
  if (!args || args.length === 0) {
    return 'Please specify a user to shoutout';
  }

  let targetUser;
  try {
    targetUser = validateUsername(args[0]);
  } catch (error) {
    return 'Invalid username provided';
  }

  try {
    if (!twitchClient?.apiClient) {
      logger.error('Missing Twitch API client');
      return getFallbackMessage(targetUser);
    }

    const channelInfo = await getChannelInfo(twitchClient, targetUser).catch(() => null);
    if (!channelInfo) {
      logger.warn('Failed to get channel info for shoutout');
      return getFallbackMessage(targetUser);
    }

    // Get both stream and channel info in parallel with error handling
    const [stream, channel] = await Promise.allSettled([
      twitchClient.apiClient.streams.getStreamByUserId(channelInfo.id),
      twitchClient.apiClient.channels.getChannelInfoById(channelInfo.id),
    ]).then((results) => [
      results[0].status === 'fulfilled' ? results[0].value : null,
      results[1].status === 'fulfilled' ? results[1].value : null,
    ]);

    const channelData = {
      name: targetUser,
      displayName: channelInfo.displayName || targetUser,
      lastGame: channel?.gameName || stream?.gameName || 'various games',
      isLive: !!stream,
      currentGame: stream?.gameName,
      title: stream?.title || channel?.title,
      description: channelInfo.description || 'awesome content',
    };

    let response;
    try {
      const prompt = createShoutoutPrompt(channelData);
      response = await generateResponse(prompt);
    } catch (error) {
      logger.error('Gemini API error during shoutout:', error);
      return getFallbackMessage(targetUser);
    }

    // Validate and clean response
    if (!response ||
        typeof response !== 'string' ||
        response.includes('Rules:') ||
        response.includes('[') ||
        response.includes(']') ||
        response.length < 50) {
      logger.warn('Invalid AI response format:', { response });
      return getFallbackMessage(targetUser);
    }

    // Clean and format the response while preserving emojis
    let cleanResponse = response
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^["']|["']$/g, '')
      .replace(/^(hey\s+everyone|hello\s+everyone|hi\s+everyone)[,!]?\s*/i, '')
      .replace(/([^.!?])\s+(but|and|or)\s+/gi, '$1, $2 ')
      .replace(/([^.!?])\s+Check them out/gi, '$1! Check them out')
      .replace(/(\w)(?=[.!?])/g, '$1,')
      .replace(/,\s*,/g, ',') // Remove double commas
      .replace(/\s+\./g, '.') // Fix spacing before periods
      .replace(/\s+!/g, '!') // Fix spacing before exclamation marks
      .replace(/\.\s*\./g, '.') // Remove multiple periods
      .replace(/([.!?])\s+([^A-Z])/g, '$1 $2') // Ensure proper spacing after punctuation
      .trim();

    // Ensure proper URL format with exact username casing
    const twitchUrl = `twitch.tv/${targetUser}`;
    if (!cleanResponse.toLowerCase().includes('twitch.tv/')) {
      cleanResponse = cleanResponse.replace(/[.!?]?\s*$/, '');
      cleanResponse += cleanResponse.endsWith('!') ?
        ` ${twitchUrl} 🎮` :
        `! Check them out at ${twitchUrl} 🎮`;
    } else {
      // Replace any case-insensitive matches with the correct casing
      cleanResponse = cleanResponse.replace(
        new RegExp(`twitch\\.tv\\/[^\\s!.?]+`, 'i'),
        twitchUrl
      );
    }

    // Ensure proper spacing around punctuation
    cleanResponse = cleanResponse
      .replace(/\s+([,.!?])/g, '$1')
      .replace(/([.!?])(?=\w)/g, '$1 ')
      .replace(/\s+/g, ' ')
      .trim();

    // Smart truncation with preserved username
    if (cleanResponse.length > 300) {
      const truncateIndex = cleanResponse.lastIndexOf(' ', 280);
      cleanResponse = truncateIndex > 0 ?
        `${cleanResponse.substring(0, truncateIndex).trim()}... ${twitchUrl} 🎮` :
        cleanResponse.substring(0, 280).trim();
    }

    // Final validation
    return cleanResponse.length >= 50 && cleanResponse.includes(twitchUrl)
      ? cleanResponse
      : getFallbackMessage(targetUser);
  } catch (error) {
    logger.error('Error generating shoutout:', error, { targetUser });
    return getFallbackMessage(targetUser);
  }
}
