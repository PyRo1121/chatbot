import clipManager from '../clipManager.js';
import logger from '../../utils/logger.js';
import { generateResponse } from '../../utils/gemini.js';

export async function handleCreateClip(client, channel, user, args) {
  try {
    const title = args ? args.join(' ') : `Clip by ${user.username}`;
    const clip = await client.twitchApi.clips.createClip({
      channel: process.env.TWITCH_CHANNEL_ID,
      title,
    });

    if (clip) {
      await clipManager.addClip({
        id: clip.id,
        url: clip.url,
        title,
        creatorName: user.username,
        timestamp: new Date().toISOString(),
        game: clip.gameId,
        views: 0,
      });

      return `Clip created! Watch it here: ${clip.url}`;
    }

    return 'Failed to create clip. Please try again later.';
  } catch (error) {
    logger.error('Error creating clip:', error);
    return 'Error creating clip. Please try again later.';
  }
}

export async function handleClipsByCategory(client, channel, user, args) {
  try {
    if (!args || args.length === 0) {
      return 'Please specify a category!';
    }

    const category = args.join(' ');
    const clips = await clipManager.getClipsByCategory(category);

    if (clips.length === 0) {
      return `No clips found for category: ${category}`;
    }

    const topClips = clips
      .slice(0, 3)
      .map((c) => `${c.title} (${c.views} views): ${c.url}`)
      .join(' | ');

    return `Top clips for ${category}: ${topClips}`;
  } catch (error) {
    logger.error('Error getting clips by category:', error);
    return 'Error retrieving clips. Please try again later.';
  }
}

export async function handleClipsByTag(client, channel, user, args) {
  try {
    if (!args || args.length === 0) {
      return 'Please specify a tag!';
    }

    const tag = args.join(' ');
    const clips = await clipManager.getClipsByTag(tag);

    if (clips.length === 0) {
      return `No clips found with tag: ${tag}`;
    }

    const topClips = clips
      .slice(0, 3)
      .map((c) => `${c.title} (${c.views} views): ${c.url}`)
      .join(' | ');

    return `Top clips for tag "${tag}": ${topClips}`;
  } catch (error) {
    logger.error('Error getting clips by tag:', error);
    return 'Error retrieving clips. Please try again later.';
  }
}

export async function handleRecentClips(client, channel, user, args) {
  try {
    const days = args && !isNaN(args[0]) ? parseInt(args[0]) : 7;
    const clips = await clipManager.getRecentClips(days);

    if (clips.length === 0) {
      return `No clips found from the last ${days} days!`;
    }

    const recentClips = clips
      .slice(0, 3)
      .map((c) => `${c.title} (${c.views} views): ${c.url}`)
      .join(' | ');

    return `Recent clips from the last ${days} days: ${recentClips}`;
  } catch (error) {
    logger.error('Error getting recent clips:', error);
    return 'Error retrieving clips. Please try again later.';
  }
}

export async function handleTopClips(client, channel, user) {
  try {
    const clips = await clipManager.getTopClips();

    if (clips.length === 0) {
      return 'No clips found!';
    }

    const topClips = clips
      .slice(0, 3)
      .map((c) => `${c.title} (${c.views} views): ${c.url}`)
      .join(' | ');

    return `Top clips: ${topClips}`;
  } catch (error) {
    logger.error('Error getting top clips:', error);
    return 'Error retrieving clips. Please try again later.';
  }
}

export async function handleClipStats(client, channel, user) {
  try {
    const stats = await clipManager.getStats();
    return `Clip Stats: Total: ${stats.totalClips} | Views: ${stats.totalViews} | Categories: ${stats.uniqueCategories} | Most Clipped: ${stats.topCategory}`;
  } catch (error) {
    logger.error('Error getting clip stats:', error);
    return 'Error retrieving clip stats. Please try again later.';
  }
}

export async function handleSuggestCompilation(client, channel, user) {
  try {
    const clips = await clipManager.getTopClips();

    if (clips.length === 0) {
      return 'Not enough clips to suggest a compilation!';
    }

    const prompt = `Based on these clips, suggest a compilation theme:
    ${clips
      .slice(0, 5)
      .map((c) => c.title)
      .join('\n')}
    
    Keep it concise and catchy, max 100 characters.`;

    const suggestion = await generateResponse(prompt);
    return suggestion || 'Unable to generate compilation suggestion at this time.';
  } catch (error) {
    logger.error('Error suggesting compilation:', error);
    return 'Error generating compilation suggestion. Please try again later.';
  }
}

export async function handleAnalyzeClip(client, channel, user, args) {
  try {
    if (!args || args.length === 0) {
      return 'Please provide a clip ID!';
    }

    const clipId = args[0];
    const clip = await clipManager.getClipById(clipId);

    if (!clip) {
      return 'Clip not found!';
    }

    const prompt = `Analyze this Twitch clip:
    Title: ${clip.title}
    Views: ${clip.views}
    Created by: ${clip.creatorName}
    Game: ${clip.game}
    
    Provide a brief analysis of its performance and potential improvements.
    Keep it concise, max 200 characters.`;

    const analysis = await generateResponse(prompt);
    return analysis || 'Unable to analyze clip at this time.';
  } catch (error) {
    logger.error('Error analyzing clip:', error);
    return 'Error analyzing clip. Please try again later.';
  }
}

// Run daily cleanup at midnight
setInterval(async () => {
  try {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      await clipManager.cleanup();
      logger.info('Daily clip cleanup completed');
    }
  } catch (error) {
    logger.error('Error in clip cleanup:', error);
  }
}, 60000); // Run every minute to check
