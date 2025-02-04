import logger from '../utils/logger.js';

// Store competitor data in memory
const competitorData = {
  trackedChannels: new Map(), // channelName -> {stats, lastUpdated}
  insights: [], // [{timestamp, type, data}]
  suggestions: [], // [{timestamp, type, suggestion}]
};

export async function trackChannel(twitchClient, channelName) {
  try {
    // Check if already tracking
    if (competitorData.trackedChannels.has(channelName)) {
      return `Already tracking ${channelName}`;
    }

    // Get channel info
    const channelInfo = await twitchClient.twitchApi.users.getUserByName(channelName);
    if (!channelInfo) {
      return `Could not find channel: ${channelName}`;
    }

    // Initialize tracking
    competitorData.trackedChannels.set(channelName, {
      id: channelInfo.id,
      displayName: channelInfo.displayName,
      stats: {
        averageViewers: 0,
        peakViewers: 0,
        totalHours: 0,
        topCategories: [],
        lastStream: null,
      },
      lastUpdated: Date.now(),
    });

    logger.info(`Started tracking competitor: ${channelName}`);
    return `Now tracking ${channelName}`;
  } catch (error) {
    logger.error('Error tracking channel:', error);
    return 'Failed to track channel';
  }
}

export async function untrackChannel(channelName) {
  try {
    if (!competitorData.trackedChannels.has(channelName)) {
      return `Not tracking ${channelName}`;
    }

    competitorData.trackedChannels.delete(channelName);
    logger.info(`Stopped tracking competitor: ${channelName}`);
    return `Stopped tracking ${channelName}`;
  } catch (error) {
    logger.error('Error untracking channel:', error);
    return 'Failed to untrack channel';
  }
}

export async function getInsights(twitchClient) {
  try {
    const insights = [];

    for (const [channelName, data] of competitorData.trackedChannels) {
      // Get current stream info
      const stream = await twitchClient.twitchApi.streams.getStreamByUserId(data.id);

      if (stream) {
        // Update stats
        data.stats.peakViewers = Math.max(data.stats.peakViewers, stream.viewerCount);
        data.stats.lastStream = {
          game: stream.gameName,
          title: stream.title,
          viewers: stream.viewerCount,
          startedAt: stream.startDate,
        };

        // Generate insights
        if (stream.viewerCount > data.stats.averageViewers * 1.5) {
          insights.push(
            `${channelName} has ${stream.viewerCount} viewers (50% above average) playing ${stream.gameName}`
          );
        }

        // Update categories
        const categoryIndex = data.stats.topCategories.findIndex((c) => c.name === stream.gameName);
        if (categoryIndex >= 0) {
          data.stats.topCategories[categoryIndex].hours += 1;
        } else {
          data.stats.topCategories.push({ name: stream.gameName, hours: 1 });
        }

        data.stats.topCategories.sort((a, b) => b.hours - a.hours);
      }
    }

    if (!insights.length) {
      return 'No significant insights at this time';
    }

    return `Competitor Insights:\n${insights.join('\n')}`;
  } catch (error) {
    logger.error('Error getting insights:', error);
    return 'Failed to get competitor insights';
  }
}

export async function getSuggestions(twitchClient) {
  try {
    const suggestions = [];
    const allCategories = new Map(); // game -> total viewers

    // Analyze all tracked channels
    for (const [channelName, data] of competitorData.trackedChannels) {
      const stream = await twitchClient.twitchApi.streams.getStreamByUserId(data.id);
      if (stream) {
        const currentViewers = allCategories.get(stream.gameName) || 0;
        allCategories.set(stream.gameName, currentViewers + stream.viewerCount);
      }
    }

    // Find trending categories
    const trendingCategories = Array.from(allCategories.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (trendingCategories.length) {
      suggestions.push('Trending categories among competitors:');
      trendingCategories.forEach(([game, viewers]) => {
        suggestions.push(`- ${game} (${viewers} total viewers)`);
      });
    }

    // Find successful stream titles
    const successfulTitles = Array.from(competitorData.trackedChannels.values())
      .filter((data) => data.stats.lastStream?.viewers > data.stats.averageViewers)
      .map((data) => data.stats.lastStream.title)
      .slice(0, 3);

    if (successfulTitles.length) {
      suggestions.push('\nSuccessful stream titles:');
      successfulTitles.forEach((title) => {
        suggestions.push(`- "${title}"`);
      });
    }

    return suggestions.join('\n') || 'No suggestions available at this time';
  } catch (error) {
    logger.error('Error getting suggestions:', error);
    return 'Failed to get competitor suggestions';
  }
}

export async function getTrackedChannels() {
  try {
    const channels = Array.from(competitorData.trackedChannels.entries())
      .map(([name, data]) => {
        const { lastStream } = data.stats;
        return `${name} (${lastStream ? `Last seen: ${lastStream.game}` : 'Offline'})`;
      })
      .join('\n');

    return channels ? `Tracked Channels:\n${channels}` : 'No channels being tracked';
  } catch (error) {
    logger.error('Error getting tracked channels:', error);
    return 'Failed to get tracked channels';
  }
}

// Update competitor stats periodically
export async function updateAllChannels(twitchClient) {
  try {
    for (const [channelName, data] of competitorData.trackedChannels) {
      const stream = await twitchClient.twitchApi.streams.getStreamByUserId(data.id);
      if (stream) {
        // Update running average
        const oldAvg = data.stats.averageViewers;
        const totalStreams = Math.floor(data.stats.totalHours) + 1;
        data.stats.averageViewers = Math.round(
          (oldAvg * (totalStreams - 1) + stream.viewerCount) / totalStreams
        );
        data.stats.totalHours++;
      }
      data.lastUpdated = Date.now();
    }
    logger.info('Updated competitor stats');
  } catch (error) {
    logger.error('Error updating competitor stats:', error);
  }
}

export default {
  trackChannel,
  untrackChannel,
  getInsights,
  getSuggestions,
  getTrackedChannels,
  updateAllChannels,
};
