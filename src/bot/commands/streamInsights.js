import logger from '../../utils/logger.js';

class StreamInsights {
  constructor(twitchApi) {
    this.twitchApi = twitchApi;
    this.cachedInsights = null;
    this.lastUpdate = 0;
    this.UPDATE_INTERVAL = 30 * 60 * 1000; // 30 minutes
  }

  async getGrowthInsights(channelName) {
    try {
      // Check cache first
      if (this.cachedInsights && Date.now() - this.lastUpdate < this.UPDATE_INTERVAL) {
        return this.cachedInsights;
      }

      // Get channel info
      const channel = await this.twitchApi.users.getUserByName(channelName);
      if (!channel) {
        throw new Error('Channel not found');
      }

      // Get recent streams
      const streams = await this.twitchApi.streams.getStreamsByUserPaginated(channel.id).getAll();

      // Get stream schedule and follower count for retention analysis
      const [schedule, followers] = await Promise.all([
        this.twitchApi.schedule.getSchedule(channel.id),
        this.twitchApi.users.getFollows({ followedUser: channel.id }),
      ]);

      // Analyze best streaming times
      const timeStats = this.analyzeBestTimes(streams);

      // Analyze game performance
      const gameStats = this.analyzeGames(streams);

      // Get similar channels for comparison
      const similarChannels = await this.findSimilarChannels(channel.id, streams[0]?.gameName);

      // Get category recommendations
      const recommendations = await this.getGameRecommendations(gameStats, similarChannels);

      // Calculate schedule consistency
      const scheduleConsistency = this.calculateScheduleConsistency(schedule, streams);

      // Calculate follower retention
      const retention = this.calculateRetention(streams, followers);

      const insights = {
        bestTimes: timeStats.bestTimes,
        worstTimes: timeStats.worstTimes,
        topGames: gameStats.slice(0, 3),
        recommendedGames: recommendations.slice(0, 5),
        scheduleConsistency,
        retention,
        growthOpportunities: this.findGrowthOpportunities(
          streams,
          gameStats,
          similarChannels,
          scheduleConsistency,
          retention
        ),
        competitorInsights: await this.analyzeCompetitors(similarChannels),
      };

      // Cache the results
      this.cachedInsights = insights;
      this.lastUpdate = Date.now();

      return insights;
    } catch (error) {
      logger.error('Error getting stream insights:', error);
      throw error;
    }
  }

  calculateScheduleConsistency(schedule, streams) {
    if (!schedule?.segments) {
      return { score: 0, message: 'No schedule set' };
    }

    const scheduledTimes = schedule.segments.map((s) => new Date(s.startTime).getHours());
    const actualTimes = streams.map((s) => new Date(s.startDate).getHours());

    // Calculate how many streams matched scheduled times
    const matchedStreams = actualTimes.filter((time) => scheduledTimes.includes(time));
    const consistencyScore = matchedStreams.length / actualTimes.length;

    return {
      score: consistencyScore,
      message: `${Math.round(consistencyScore * 100)}% schedule consistency`,
      scheduledTimes,
      actualTimes,
    };
  }

  calculateRetention(streams, followers) {
    const totalFollowers = followers.total;
    const averageViewers =
      streams.reduce((sum, s) => sum + (s.averageViewerCount || 0), 0) / streams.length;
    const retentionRate = averageViewers / totalFollowers;

    return {
      rate: retentionRate,
      followers: totalFollowers,
      averageViewers,
      message: `${Math.round(retentionRate * 100)}% viewer retention rate`,
    };
  }

  analyzeBestTimes(streams) {
    const timeSlots = Array(24)
      .fill()
      .map(() => ({
        viewers: 0,
        streams: 0,
        engagement: 0,
      }));

    streams.forEach((stream) => {
      const hour = new Date(stream.startDate).getHours();
      timeSlots[hour].viewers += stream.averageViewerCount || 0;
      timeSlots[hour].streams++;
      timeSlots[hour].engagement +=
        (stream.averageViewerCount || 0) / (stream.peakViewerCount || 1);
    });

    // Calculate average viewers per time slot
    timeSlots.forEach((slot) => {
      if (slot.streams > 0) {
        slot.avgViewers = slot.viewers / slot.streams;
        slot.avgEngagement = slot.engagement / slot.streams;
      }
    });

    // Sort by average viewers and engagement
    const sortedSlots = timeSlots
      .map((slot, hour) => ({ hour, ...slot }))
      .filter((slot) => slot.streams > 0)
      .sort((a, b) => b.avgViewers * b.avgEngagement - a.avgViewers * a.avgEngagement);

    return {
      bestTimes: sortedSlots.slice(0, 3),
      worstTimes: sortedSlots.slice(-3).reverse(),
    };
  }

  analyzeGames(streams) {
    const gameStats = new Map();

    for (const stream of streams) {
      if (!stream.gameName) {
        continue;
      }

      if (!gameStats.has(stream.gameName)) {
        gameStats.set(stream.gameName, {
          name: stream.gameName,
          totalViewers: 0,
          peakViewers: 0,
          streams: 0,
          averageViewers: 0,
          averageEngagement: 0,
          followersGained: 0,
        });
      }

      const stats = gameStats.get(stream.gameName);
      stats.totalViewers += stream.averageViewerCount || 0;
      stats.peakViewers = Math.max(stats.peakViewers, stream.peakViewerCount || 0);
      stats.streams++;
      stats.followersGained += stream.followersGained || 0;
    }

    // Calculate averages and sort by performance
    return Array.from(gameStats.values())
      .map((stats) => ({
        ...stats,
        averageViewers: stats.totalViewers / stats.streams,
        averageEngagement: stats.followersGained / stats.streams,
      }))
      .sort(
        (a, b) => b.averageViewers * b.averageEngagement - a.averageViewers * a.averageEngagement
      );
  }

  async findSimilarChannels(channelId, currentGame, limit = 5) {
    try {
      // Get streams in same category
      const streams = await this.twitchApi.streams.getStreams({
        game: currentGame,
        first: 100,
      });

      // Filter to find channels close to your size
      const targetChannel = streams.data.find((s) => s.userId === channelId);
      const targetViewers = targetChannel?.viewerCount || 5;

      return streams.data
        .filter(
          (stream) =>
            stream.userId !== channelId &&
            stream.viewerCount > targetViewers * 0.5 &&
            stream.viewerCount < targetViewers * 2
        )
        .sort(
          (a, b) =>
            Math.abs(a.viewerCount - targetViewers) - Math.abs(b.viewerCount - targetViewers)
        )
        .slice(0, limit);
    } catch (error) {
      logger.error('Error finding similar channels:', error);
      return [];
    }
  }

  async getGameRecommendations(gameStats, similarChannels) {
    try {
      const recommendations = new Map();
      const processedStreams = new Map();

      // Get all streams from similar channels at once
      const channelStreams = await Promise.all(
        similarChannels.map((channel) =>
          this.twitchApi.streams.getStreamsByUserPaginated(channel.userId).getAll()
        )
      );

      // Process all streams
      channelStreams.flat().forEach((stream) => {
        if (!stream.gameName || processedStreams.has(stream.id)) {
          return;
        }
        processedStreams.set(stream.id, true);

        if (!recommendations.has(stream.gameName)) {
          recommendations.set(stream.gameName, {
            name: stream.gameName,
            score: 0,
            averageViewers: 0,
            channels: 0,
            growth: 0,
          });
        }

        const rec = recommendations.get(stream.gameName);
        rec.averageViewers += stream.averageViewerCount || 0;
        rec.channels++;
        rec.growth += stream.followersGained || 0;
      });

      // Calculate scores based on viewer counts and growth potential
      return Array.from(recommendations.values())
        .map((rec) => ({
          ...rec,
          averageViewers: rec.averageViewers / rec.channels,
          growthRate: rec.growth / rec.channels,
          score: (rec.averageViewers * rec.growth) / (rec.channels * rec.channels),
        }))
        .sort((a, b) => b.score - a.score);
    } catch (error) {
      logger.error('Error getting game recommendations:', error);
      return [];
    }
  }

  findGrowthOpportunities(streams, gameStats, similarChannels, scheduleConsistency, retention) {
    const opportunities = [];

    // Analyze stream timing
    const timeStats = this.analyzeBestTimes(streams);
    if (timeStats.bestTimes[0]?.avgViewers > timeStats.worstTimes[0]?.avgViewers * 1.5) {
      opportunities.push({
        type: 'timing',
        message: `Consider streaming more during ${timeStats.bestTimes[0].hour}:00, which shows ${Math.round(timeStats.bestTimes[0].avgViewers)} average viewers vs ${Math.round(timeStats.worstTimes[0].avgViewers)} during ${timeStats.worstTimes[0].hour}:00`,
      });
    }

    // Analyze game variety
    if (gameStats.length < 3) {
      opportunities.push({
        type: 'variety',
        message: 'Consider trying more game varieties to find your best performing content',
      });
    }

    // Analyze schedule consistency
    if (scheduleConsistency.score < 0.7) {
      opportunities.push({
        type: 'schedule',
        message: 'More consistent streaming schedule could improve viewer retention',
      });
    }

    // Analyze viewer retention
    if (retention.rate < 0.1) {
      opportunities.push({
        type: 'engagement',
        message: 'Focus on viewer engagement to improve follower-to-viewer conversion',
      });
    }

    // Analyze stream duration
    const avgDuration = streams.reduce((sum, s) => sum + (s.duration || 0), 0) / streams.length;
    if (avgDuration < 180) {
      // 3 hours
      opportunities.push({
        type: 'duration',
        message: 'Longer streams (4+ hours) often lead to better discovery and viewer retention',
      });
    }

    // Analyze successful similar channels
    const successfulPeers = similarChannels.filter(
      (c) => c.viewerCount > streams[0]?.viewerCount * 1.5
    );
    if (successfulPeers.length > 0) {
      opportunities.push({
        type: 'networking',
        message: `Consider networking with similar channels like ${successfulPeers.map((c) => c.userName).join(', ')}`,
      });
    }

    return opportunities;
  }

  async analyzeCompetitors(similarChannels) {
    const analysis = [];
    const processedStreams = new Map();

    // Get all streams and schedules at once
    const [allStreams, allSchedules] = await Promise.all([
      Promise.all(
        similarChannels.map((channel) =>
          this.twitchApi.streams.getStreamsByUserPaginated(channel.userId).getAll()
        )
      ),
      Promise.all(
        similarChannels.map((channel) => this.twitchApi.schedule.getSchedule(channel.userId))
      ),
    ]);

    // Process each channel's data
    similarChannels.forEach((channel, index) => {
      try {
        const streams = allStreams[index].filter((s) => !processedStreams.has(s.id));
        streams.forEach((s) => processedStreams.set(s.id, true));

        const schedule = allSchedules[index];
        const avgViewers =
          streams.reduce((sum, s) => sum + (s.averageViewerCount || 0), 0) / streams.length;
        const avgDuration = streams.reduce((sum, s) => sum + (s.duration || 0), 0) / streams.length;
        const commonGames = this.findCommonGames(streams);

        analysis.push({
          channelName: channel.userName,
          averageViewers: Math.round(avgViewers),
          averageStreamLength: Math.round(avgDuration / 60), // in minutes
          topGames: commonGames.slice(0, 3),
          scheduledDays:
            schedule?.segments?.map((s) => new Date(s.startTime).toLocaleDateString()) || [],
        });
      } catch (error) {
        logger.error(`Error analyzing competitor ${channel.userName}:`, error);
      }
    });

    return analysis;
  }

  findCommonGames(streams) {
    const games = new Map();
    streams.forEach((stream) => {
      if (!stream.gameName) {
        return;
      }
      games.set(stream.gameName, (games.get(stream.gameName) || 0) + 1);
    });
    return Array.from(games.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }
}

export default StreamInsights;

export async function handleStreamInsights(username, args, userLevel, twitchApi) {
  if (userLevel !== 'broadcaster') {
    return {
      success: false,
      message: 'This command is for the broadcaster only!',
    };
  }

  try {
    const insights = new StreamInsights(twitchApi);
    const data = await insights.getGrowthInsights(username);

    // Format best times
    const bestTimes = data.bestTimes
      .map((t) => `${t.hour}:00 (${Math.round(t.avgViewers)} avg viewers)`)
      .join(', ');

    // Format game recommendations
    const recommendedGames = data.recommendedGames.map((g) => g.name).join(', ');

    // Format growth opportunities
    const opportunities = data.growthOpportunities.map((o) => o.message).join(' | ');

    return {
      success: true,
      message: `📊 Stream Insights | Best Times: ${bestTimes} | Recommended Games: ${recommendedGames} | Growth Tips: ${opportunities}`,
      fullData: data, // For potential overlay display
    };
  } catch (error) {
    logger.error('Error getting stream insights:', error);
    return {
      success: false,
      message: 'Failed to get stream insights. Please try again later.',
    };
  }
}
