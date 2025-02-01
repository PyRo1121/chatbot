import logger from '../../utils/logger.js';
import streamManager from '../streamManager.js';
import { generateResponse } from '../../utils/perplexity.js';

export async function handleTitle(client, channel, user, args) {
  try {
    if (!args || args.length === 0) {
      return 'Please provide a new title!';
    }

    const newTitle = args.join(' ');
    await client.twitchApi.channels.updateChannelInfo(
      process.env.TWITCH_CHANNEL_ID,
      {
        title: newTitle,
      }
    );

    return `Stream title updated to: ${newTitle}`;
  } catch (error) {
    logger.error('Error updating title:', error);
    return 'Error updating stream title. Please try again later.';
  }
}

export async function handleCategory(client, channel, user, args) {
  try {
    if (!args || args.length === 0) {
      return 'Please provide a category/game name!';
    }

    const gameName = args.join(' ');
    const game = await client.twitchApi.games.getGameByName(gameName);

    if (!game) {
      return `Could not find game: ${gameName}`;
    }

    await client.twitchApi.channels.updateChannelInfo(
      process.env.TWITCH_CHANNEL_ID,
      {
        gameId: game.id,
      }
    );

    return `Stream category updated to: ${game.name}`;
  } catch (error) {
    logger.error('Error updating category:', error);
    return 'Error updating stream category. Please try again later.';
  }
}

export async function handleUptime(client, channel, user) {
  try {
    const stream = await client.twitchApi.streams.getStreamByUserId(
      process.env.TWITCH_CHANNEL_ID
    );

    if (!stream) {
      return 'Stream is currently offline!';
    }

    const uptime = Math.floor(
      (Date.now() - stream.startDate.getTime()) / 1000 / 60
    );
    const hours = Math.floor(uptime / 60);
    const minutes = uptime % 60;

    return `Stream has been live for ${hours}h ${minutes}m!`;
  } catch (error) {
    logger.error('Error getting uptime:', error);
    return 'Error getting stream uptime. Please try again later.';
  }
}

export async function handleMilestone(client, channel, user, args) {
  try {
    if (!args || args.length === 0) {
      return 'Please provide a milestone description!';
    }

    const description = args.join(' ');
    const prompt = `Create an exciting milestone announcement for: ${description}
    Make it engaging and celebratory. Keep it under 200 characters.`;

    const announcement = await generateResponse(prompt);
    const message =
      announcement || `We just hit a milestone: ${description}! 🎉`;

    streamManager.addHighlight({
      type: 'milestone',
      description,
      timestamp: new Date().toISOString(),
    });

    return message;
  } catch (error) {
    logger.error('Error handling milestone:', error);
    return 'Error processing milestone. Please try again later.';
  }
}

export async function handleRecommendations(client, channel, user) {
  try {
    const stats = streamManager.getStreamStats();
    const prompt = `Based on these stream stats, suggest content improvements:
    Average Viewers: ${stats.currentStream.viewers.reduce((a, b) => a + b, 0) / stats.currentStream.viewers.length}
    Chat Activity: ${stats.currentStream.chatActivity}
    Popular Commands: ${Object.entries(stats.currentStream.commands)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([cmd, count]) => `${cmd}(${count})`)
      .join(', ')}
    
    Provide 2-3 actionable suggestions. Keep it concise, max 200 characters.`;

    const suggestions = await generateResponse(prompt);
    return suggestions || 'Unable to generate recommendations at this time.';
  } catch (error) {
    logger.error('Error generating recommendations:', error);
    return 'Error generating recommendations. Please try again later.';
  }
}

export async function handleChatInsights(client, channel, user) {
  try {
    const stats = streamManager.getStreamStats();
    const prompt = `Analyze this chat data:
    Messages: ${stats.currentStream.chatActivity}
    Commands Used: ${Object.keys(stats.currentStream.commands).length}
    Top Commands: ${Object.entries(stats.currentStream.commands)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([cmd, count]) => `${cmd}(${count})`)
      .join(', ')}
    
    Provide a brief analysis of chat engagement. Keep it concise, max 200 characters.`;

    const analysis = await generateResponse(prompt);
    return analysis || 'Unable to generate chat insights at this time.';
  } catch (error) {
    logger.error('Error generating chat insights:', error);
    return 'Error generating chat insights. Please try again later.';
  }
}

export default {
  handleTitle,
  handleCategory,
  handleUptime,
  handleMilestone,
  handleRecommendations,
  handleChatInsights,
};
