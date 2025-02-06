import { generateResponse } from '../../utils/deepseek.js';
import logger from '../../utils/logger.js';
import { viewerManager } from '../viewerManager.js';

export async function handleShoutout(twitchClient, channel, user, args) {
  if (!args || args.length === 0) {
    return 'Please specify a user to shoutout';
  }

  const targetUser = args[0].replace('@', '');

  try {
    // Get channel info from Twitch API
    const channelInfo = await twitchClient.apiClient.users.getUserByName(targetUser);
    if (!channelInfo) {
      return `Hey everyone! Check out @${targetUser} over at twitch.tv/${targetUser}! They're awesome! 🎮`;
    }

    // Get their stream info
    const stream = await twitchClient.apiClient.streams.getStreamByUserId(channelInfo.id);
    const channelData = {
      name: targetUser,
      displayName: channelInfo.displayName,
      lastGame: stream?.gameName || 'various games',
      isLive: !!stream,
      currentGame: stream?.gameName,
      title: stream?.title,
      description: channelInfo.description || 'awesome content',
    };

    // Get viewer history summaries
    const targetHistorySummary = viewerManager.getViewerHistorySummary(targetUser);

    // Create a witty prompt using their actual data
    const prompt = `Create an engaging Twitch shoutout with EXACTLY 350 characters:

STREAMER DETAILS:
- Name: ${channelData.displayName}
- Current: ${channelData.isLive ? `Live playing ${channelData.currentGame}` : `Last seen playing ${channelData.lastGame}`}
- Style: ${channelData.description || 'awesome content'}

YOUR TASK:
Write a shoutout in exactly this order:
1. Greeting (75 chars)
2. Streamer description & games (300 chars)
3. End exactly with: "Check them out at twitch.tv/${targetUser}!" (50 chars)

REQUIRED:
- Must mention their games
- Must describe their style
- Must include personality traits
- Must end with the exact URL format
- No trailing sentences
- check for proper grammar and punctuation
- Complete thoughts only
- Every detail matters

Note: Count your characters carefully and hit exactly 350 total.`;

const response = await generateResponse(prompt).catch(e => {
  logger.error('Gemini API error during shoutout:', e, { prompt });
  throw e;
});

// Clean and validate response
let cleanResponse = response
  ?.replace(/\.{2,}|…/g, '.') // Remove ellipsis
  ?.replace(/\s+/g, ' ') // Normalize spaces
  ?.trim();

if (!cleanResponse?.includes(`twitch.tv/${targetUser}`)) {
  throw new Error('Shoutout missing Twitch URL');
}

// Clean up any potential markdown or formatting
cleanResponse = cleanResponse
  ?.replace(/[*_`#"'-]/g, '') // Remove markdown characters and quotes
  ?.replace(/\n/g, ' ') // Replace newlines with spaces
  ?.replace(/\s+/g, ' ') // Normalize spaces
  ?.trim();

    // Enforce character limit
    if (cleanResponse && cleanResponse.length > 400) {
      cleanResponse = cleanResponse.substring(0, 400) + '...';
    }

    return (
      cleanResponse ||
      `Hey everyone! Check out @${targetUser} over at twitch.tv/${targetUser}! They're awesome! 🎮`
    );
  } catch (error) {
    logger.error('Error generating shoutout:', error, { targetUser, channelData });
    return `Hey everyone! Check out @${targetUser} over at twitch.tv/${targetUser}! They're awesome! 🎮`;
  }
}
