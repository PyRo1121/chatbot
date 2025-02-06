import { ApiClient } from '@twurple/api';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { EventEmitter } from 'events';
import logger from '../utils/logger.js';
import { generateResponse } from '../utils/deepseek.js';

class StreamManager extends EventEmitter {
  constructor() {
    super();
    this.streamData = this.loadStreamData();
    this.currentStream = {
      startTime: null,
      endTime: null,
      viewers: [],
      chatActivity: 0,
      commands: {},
      highlights: [],
      raids: [],
    };
    this.isEndingStream = false;
    this.initStreamData();
  }

  loadStreamData() {
    try {
      const data = readFileSync(join(process.cwd(), 'src/bot/stream_data.json'), 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error loading stream data:', error);
      return {
        totalStreams: 0,
        totalHours: 0,
        streamHistory: {},
        viewerStats: {
          peak: 0,
          average: 0,
          retention: 0,
        },
        performance: {
          categories: {},
          titles: {},
          times: {},
        },
      };
    }
  }

  saveStreamData() {
    try {
      writeFileSync(
        join(process.cwd(), 'src/bot/stream_data.json'),
        JSON.stringify(this.streamData, null, 2)
      );
    } catch (error) {
      logger.error('Error saving stream data:', error);
    }
  }

  initStreamData() {
    if (!this.streamData.streamHistory) {
      this.streamData.streamHistory = {};
    }
    if (!this.streamData.viewerStats) {
      this.streamData.viewerStats = { peak: 0, average: 0, retention: 0 };
    }
    if (!this.streamData.performance) {
      this.streamData.performance = { categories: {}, titles: {}, times: {} };
    }
  }

  startStream() {
    this.currentStream.startTime = Date.now();
    this.streamData.totalStreams++;
    logger.info('Stream started');
  }

  calculateHealthScore(streamData) {
    try {
      if (!streamData || !streamData.viewers || streamData.viewers.length === 0) {
        logger.debug('No stream data available for health score calculation');
        return 0;
      }

      // Validate required data
      if (!Array.isArray(streamData.viewers) || !streamData.chatActivity || !streamData.commands) {
        logger.warn('Invalid stream data for health score calculation:', {
          streamData,
        });
        return 0;
      }

      // Calculate various metrics
      const peakViewers = Math.max(...streamData.viewers);
      const avgViewers =
        streamData.viewers.reduce((sum, count) => sum + count, 0) / streamData.viewers.length;
      const retention =
        streamData.viewers.length > 0
          ? (streamData.viewers[streamData.viewers.length - 1] / peakViewers) * 100
          : 0;

      const chatEngagement = streamData.chatActivity / (streamData.viewers.length || 1);
      const commandUsage = Object.values(streamData.commands).reduce(
        (sum, count) => sum + count,
        0
      );

      // Weight different factors
      const viewerScore = Math.min((avgViewers / (peakViewers || 1)) * 40, 40); // Up to 40 points for viewer retention
      const chatScore = Math.min(chatEngagement * 5, 30); // Up to 30 points for chat engagement
      const commandScore = Math.min(commandUsage / 10, 20); // Up to 20 points for command usage
      const highlightScore = Math.min(streamData.highlights?.length * 2 || 0, 10); // Up to 10 points for highlights

      // Calculate total score (0-100)
      return Math.round(viewerScore + chatScore + commandScore + highlightScore);
    } catch (error) {
      logger.error('Error calculating health score:', error);
      return 0;
    }
  }

  endStream() {
    logger.debug('Starting stream end process');

    // Prevent multiple end stream calls
    if (this.isEndingStream) {
      logger.warn('Stream end already in progress, skipping');
      return;
    }
    this.isEndingStream = true;

    // If no stream was active, emit default insights and return
    if (!this.currentStream.startTime) {
      logger.info('No active stream found');
      const defaultInsights = {
        health: {
          status: 'offline',
          score: 0,
          bitrate: { average: 0, stability: 'stable' },
        },
        stats: {
          peakViewers: 0,
          averageViewers: 0,
          totalMessages: 0,
          activeViewers: [],
        },
        performance: {
          bestCategory: 'No category data available',
          viewerRetention: 0,
          averageEngagement: 0,
          improvements: ['No stream data available', 'Try streaming first!'],
        },
      };
      this.emit('streamEnd', defaultInsights);
      return;
    }

    this.currentStream.endTime = Date.now();
    const duration = (this.currentStream.endTime - this.currentStream.startTime) / 1000 / 60 / 60;
    this.streamData.totalHours += duration;

    // Update stream history
    const streamDate = new Date().toISOString().split('T')[0];
    this.streamData.streamHistory[streamDate] = {
      duration,
      viewers: {
        peak: Math.max(...this.currentStream.viewers, 0),
        average:
          this.currentStream.viewers.reduce((sum, count) => sum + count, 0) /
          this.currentStream.viewers.length,
      },
      chatActivity: this.currentStream.chatActivity,
      commands: this.currentStream.commands,
      highlights: this.currentStream.highlights,
      raids: this.currentStream.raids,
    };

    // Update viewer stats
    this.streamData.viewerStats.peak = Math.max(
      this.streamData.viewerStats.peak,
      Math.max(...this.currentStream.viewers, 0)
    );
    this.streamData.viewerStats.average =
      (this.streamData.viewerStats.average * (this.streamData.totalStreams - 1) +
        this.currentStream.viewers.reduce((sum, count) => sum + count, 0) /
          this.currentStream.viewers.length) /
      this.streamData.totalStreams;

    // Save data and log insights
    this.saveStreamData();

    // Log detailed stream insights
    const stats = {
      duration: duration.toFixed(2),
      viewers: {
        peak: Math.max(...this.currentStream.viewers, 0),
        average: (
          this.currentStream.viewers.reduce((sum, count) => sum + count, 0) /
          this.currentStream.viewers.length
        ).toFixed(1),
        retention:
          this.currentStream.viewers.length > 0
            ? (
                (this.currentStream.viewers[this.currentStream.viewers.length - 1] /
                  Math.max(...this.currentStream.viewers)) *
                100
              ).toFixed(1)
            : 0,
      },
      engagement: {
        chatMessages: this.currentStream.chatActivity,
        messagesPerHour: (this.currentStream.chatActivity / duration).toFixed(1),
        commands: Object.entries(this.currentStream.commands).reduce(
          (sum, [_, count]) => sum + count,
          0
        ),
        highlights: this.currentStream.highlights.length,
        raids: this.currentStream.raids.length,
      },
    };

    logger.info('Stream Insights:', {
      duration: `${stats.duration} hours`,
      viewers: `Peak: ${stats.viewers.peak}, Avg: ${stats.viewers.average}, Retention: ${stats.viewers.retention}%`,
      engagement: `${stats.engagement.chatMessages} messages (${stats.engagement.messagesPerHour}/hr), ${stats.engagement.commands} commands, ${stats.engagement.highlights} highlights, ${stats.engagement.raids} raids`,
    });

    // Return stream insights for the bot to handle
    const insights = {
      health: {
        status: 'offline',
        score: 0,
        bitrate: { average: 0, stability: 'stable' },
      },
      stats: {
        peakViewers: 0,
        averageViewers: 0,
        totalMessages: 0,
        activeViewers: [],
      },
      performance: {
        bestCategory: 'No category data available',
        viewerRetention: 0,
        averageEngagement: 0,
        improvements: ['No stream data available', 'Try streaming first!'],
      },
    };

    // Only update insights if we have valid stream data
    if (this.currentStream.viewers.length > 0) {
      insights.health = {
        status:
          this.calculateHealthScore(this.currentStream) > 70
            ? 'healthy'
            : this.calculateHealthScore(this.currentStream) > 40
              ? 'warning'
              : 'critical',
        score: this.calculateHealthScore(this.currentStream),
        bitrate: { average: 0, stability: 'stable' },
      };
      insights.stats = {
        peakViewers: stats.viewers.peak,
        averageViewers: parseFloat(stats.viewers.average),
        totalMessages: stats.engagement.chatMessages,
        activeViewers: [], // Would need to track individual viewer messages to populate this
      };
      insights.performance = {
        bestCategory: this.getBestCategory(),
        viewerRetention: parseFloat(stats.viewers.retention),
        averageEngagement: parseFloat((stats.engagement.messagesPerHour / 10).toFixed(1)), // Normalize to percentage
        improvements: [
          `Focus on viewer interaction (${stats.engagement.messagesPerHour} messages/hr)`,
          `Work on viewer retention (${stats.viewers.retention}% retained)`,
        ],
      };
    }

    // Log and emit stream end event with insights
    logger.debug('Emitting streamEnd event with insights:', insights);
    this.emit('streamEnd', insights);
    logger.debug('StreamEnd event emitted');

    try {
      // Reset current stream
      this.currentStream = {
        startTime: null,
        endTime: null,
        viewers: [],
        chatActivity: 0,
        commands: {},
        highlights: [],
        raids: [],
      };
    } finally {
      this.isEndingStream = false;
    }
  }

  updateViewers(count) {
    this.currentStream.viewers.push(count);
  }

  trackCommand(command) {
    this.currentStream.commands[command] = (this.currentStream.commands[command] || 0) + 1;
  }

  trackChatActivity() {
    this.currentStream.chatActivity++;
  }

  addHighlight(highlight) {
    this.currentStream.highlights.push({
      timestamp: Date.now(),
      ...highlight,
    });
  }

  trackRaid(raid) {
    this.currentStream.raids.push({
      timestamp: Date.now(),
      ...raid,
    });
  }

  async generateStreamEndMessage() {
    try {
      const stats = {
        duration: ((Date.now() - this.currentStream.startTime) / 1000 / 60 / 60).toFixed(2),
        peakViewers: Math.max(...this.currentStream.viewers, 0),
        averageViewers: (
          this.currentStream.viewers.reduce((sum, count) => sum + count, 0) /
          this.currentStream.viewers.length
        ).toFixed(1),
        chatMessages: this.currentStream.chatActivity,
        commands: Object.entries(this.currentStream.commands)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([cmd, count]) => `${cmd}(${count})`)
          .join(', '),
        highlights: this.currentStream.highlights.length,
        raids: this.currentStream.raids.length,
      };

      const prompt = `Generate a stream end message with these stats:
      Duration: ${stats.duration} hours
      Peak Viewers: ${stats.peakViewers}
      Average Viewers: ${stats.averageViewers}
      Chat Messages: ${stats.chatMessages}
      Top Commands: ${stats.commands}
      Highlights: ${stats.highlights}
      Raids: ${stats.raids}
      
      Make it engaging and thankful to the community. Keep it under 300 characters.`;

      const message = await generateResponse(prompt);
      return message || 'Stream ended! Thanks for watching!';
    } catch (error) {
      logger.error('Error generating stream end message:', error);
      return 'Stream ended! Thanks for watching!';
    }
  }

  getStreamStats() {
    return {
      currentStream: {
        duration: this.currentStream.startTime
          ? (Date.now() - this.currentStream.startTime) / 1000 / 60 / 60
          : 0,
        viewers: this.currentStream.viewers,
        chatActivity: this.currentStream.chatActivity,
        commands: this.currentStream.commands,
        highlights: this.currentStream.highlights,
        raids: this.currentStream.raids,
      },
      overall: {
        totalStreams: this.streamData.totalStreams,
        totalHours: this.streamData.totalHours,
        viewerStats: this.streamData.viewerStats,
        performance: this.streamData.performance,
      },
    };
  }

  getBestCategory() {
    // If no performance data is available, return a default message
    if (
      !this.streamData.performance?.categories ||
      Object.keys(this.streamData.performance.categories).length === 0
    ) {
      return 'No category data available';
    }

    // Find the category with the highest average viewers
    const categories = Object.entries(this.streamData.performance.categories);
    const bestCategory = categories.reduce((best, [category, stats]) => {
      if (!best || stats.averageViewers > best.stats.averageViewers) {
        return { category, stats };
      }
      return best;
    }, null);

    return bestCategory ? bestCategory.category : 'No category data available';
  }

  cleanup() {
    // Keep only last 30 days of stream history
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

    this.streamData.streamHistory = Object.entries(this.streamData.streamHistory)
      .filter(([date]) => date >= cutoffDate)
      .reduce((acc, [date, data]) => {
        acc[date] = data;
        return acc;
      }, {});

    // Calculate cleanup insights
    const removedDates = Object.keys(this.streamData.streamHistory).filter(
      (date) => date < cutoffDate
    );
    const retainedDates = Object.keys(this.streamData.streamHistory);

    const cleanupStats = {
      daysRemoved: removedDates.length,
      daysRetained: retainedDates.length,
      dateRange:
        retainedDates.length > 0
          ? `${retainedDates[0]} to ${retainedDates[retainedDates.length - 1]}`
          : 'None',
    };

    this.saveStreamData();
    logger.info('Stream Data Cleanup:', {
      removed: `${cleanupStats.daysRemoved} days of historical data`,
      retained: `${cleanupStats.daysRetained} days (${cleanupStats.dateRange})`,
    });
  }
}

const streamManager = new StreamManager();

// Ensure all handlers are properly bound to maintain context
const boundHandlers = {
  onStreamStart: streamManager.startStream.bind(streamManager),
  onStreamEnd: () => {
    logger.debug('Stream end handler called');
    return streamManager.endStream();
  },
  onViewerUpdate: streamManager.updateViewers.bind(streamManager),
  onChatActivity: streamManager.trackChatActivity.bind(streamManager),
  onCommand: streamManager.trackCommand.bind(streamManager),
  onRaid: streamManager.trackRaid.bind(streamManager),
};

export const streamEventHandlers = boundHandlers;

export async function detectHighlight(message, viewerCount, totalInteractions) {
  try {
    const prompt = `Analyze this chat message for potential stream highlight:
    Message: ${message}
    Current Viewers: ${viewerCount}
    Total Chat Interactions: ${totalInteractions}
    
    Respond with true if this seems like a highlight moment, false otherwise.`;

    const response = await generateResponse(prompt);
    return response?.toLowerCase().includes('true') || false;
  } catch (error) {
    logger.error('Error detecting highlight:', error);
    return false;
  }
}

export const streamCommands = {
  uptime: () => {
    if (!streamManager.currentStream.startTime) {
      return 'Stream is offline';
    }
    const duration = (Date.now() - streamManager.currentStream.startTime) / 1000;
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    return `${hours}h ${minutes}m`;
  },
};

export default streamManager;
