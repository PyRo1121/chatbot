import logger from '../../utils/logger.js';
import clipManager from '../clipManager.js';

export async function handleClip(client, channel, user, args) {
  try {
    if (!client?.apiClient) {
      throw new Error('API client not initialized');
    }

    const title = args ? args.join(' ') : `Clip by ${user.username}`;
    const clip = await client.apiClient.clips.createClip({
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

export async function handleHighlights(client, channel, user, args) {
  try {
    const days = args && !isNaN(args[0]) ? parseInt(args[0]) : 7;
    const highlights = await clipManager.getHighlights(days);

    if (highlights.length === 0) {
      return `No highlights found in the last ${days} days!`;
    }

    const topHighlights = highlights
      .slice(0, 3)
      .map((h) => `${h.title} (${h.views} views): ${h.url}`)
      .join(' | ');

    return `Top highlights from the last ${days} days: ${topHighlights}`;
  } catch (error) {
    logger.error('Error getting highlights:', error);
    return 'Error retrieving highlights. Please try again later.';
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
