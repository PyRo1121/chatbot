import { generateResponse } from '../../utils/gemini.js';
import logger from '../../utils/logger.js';

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

    // Create a witty prompt using their actual data
    const prompt = `Create a funny and witty Twitch shoutout for ${channelData.displayName} that includes these details in a natural way:
    - They ${channelData.isLive ? `are live playing ${channelData.currentGame}` : `were last seen playing ${channelData.lastGame}`}
    - Their channel description: "${channelData.description}"
    - Stream title (if live): "${channelData.title || ''}"

    Make it humorous and witty but friendly, around 300-400 characters. Include their URL (twitch.tv/${targetUser}) and some fitting emojis.
    Focus on being entertaining while highlighting their actual content.
    
    Example style: "Hold onto your keyboards, chat! The legendary [name] is here, fresh from [funny reference to their game/content]! When they're not [witty comment about their description], they're busy [humorous take on their stream title/content]. Don't miss out - catch the action at [url]! 🎮 ✨"`;

    const response = await generateResponse(prompt);

    // Clean up any potential markdown or formatting
    const cleanResponse = response
      ?.replace(/[*_`#"'-]/g, '') // Remove markdown characters and quotes
      ?.replace(/\n/g, ' ') // Replace newlines with spaces
      ?.replace(/\s+/g, ' ') // Normalize spaces
      ?.trim();

    return (
      cleanResponse ||
      `Hey everyone! Check out @${targetUser} over at twitch.tv/${targetUser}! They're awesome! 🎮`
    );
  } catch (error) {
    logger.error('Error generating shoutout:', error);
    return `Hey everyone! Check out @${targetUser} over at twitch.tv/${targetUser}! They're awesome! 🎮`;
  }
}
