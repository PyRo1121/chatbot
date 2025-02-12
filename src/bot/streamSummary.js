import logger from '../utils/logger.js';
import enhancedAnalytics from './enhancedAnalytics.js';
import contentManager from './contentManager.js';
import AIService from '../utils/aiService.js';

// Constants for better maintainability
const CONSTANTS = {
  SEGMENT_DURATION: 15 * 60 * 1000, // 15 minutes in milliseconds
  MAX_HIGHLIGHTS: 5,
  ENGAGEMENT_THRESHOLD: 0.5,
  PEAK_RATIO_THRESHOLD: 1.5,
  SENTIMENT_THRESHOLDS: {
    VERY_POSITIVE: 0.6,
    POSITIVE: 0.2,
    VERY_NEGATIVE: -0.6,
    NEGATIVE: -0.2,
  },
  MESSAGE_TRUNCATE_LENGTH: 100,
};

class StreamSummary {
  constructor() {
    this.aiService = new AIService();
    this.emoteRegex = /:\w+:|[\u{1F300}-\u{1F9FF}]/gu;
  }

  async generateEndOfStreamSummary() {
    try {
      const [analytics, highlights, timeline] = await Promise.all([
        enhancedAnalytics.getStreamPerformance(),
        contentManager.getRecentHighlights(),
        enhancedAnalytics.getEngagementTimeline('24h'),
      ]);

      if (!timeline?.length) {
        logger.warn('No timeline data available for summary generation');
        return 'Insufficient data to generate stream summary';
      }

      const streamStart = Math.min(...timeline.map((event) => event.timestamp));
      const duration = Math.floor((Date.now() - streamStart) / (1000 * 60));
      const metrics = this.calculateStreamMetrics(timeline);
      const chatSummary = await this.generateChatSummary(timeline);

      return this.formatSummary(duration, metrics, highlights, chatSummary, analytics);
    } catch (error) {
      logger.error('Error generating stream summary:', error);
      throw new Error('Failed to generate stream summary');
    }
  }

  formatSummary(duration, metrics, highlights, chatSummary, analytics) {
    const sections = {
      header: [`📊 Stream Summary (${duration} minutes)`, ''],
      performance: [
        '📈 Performance',
        `• Peak Viewers: ${metrics.peakViewers}`,
        `• Average Viewers: ${metrics.avgViewers}`,
        `• Chat Messages: ${metrics.totalMessages}`,
        `• Unique Chatters: ${metrics.uniqueChatters.size}`,
        `• Engagement Rate: ${Math.round(metrics.engagementRate * 100)}%`,
        '',
      ],
      highlights: ['🎯 Highlights', ...this.formatHighlights(highlights), ''],
      chatAnalysis: [
        '💬 Chat Analysis',
        `• Overall Mood: ${metrics.overallMood}`,
        `• Most Active Hour: ${metrics.mostActiveHour}:00`,
        `• Top Emotes: ${metrics.topEmotes.join(', ')}`,
        '',
      ],
      topMoments: ['🏆 Top Moments', ...chatSummary.moments, ''],
      insights: ['📝 Insights', ...this.generateInsights(analytics, metrics), ''],
      recommendations: [
        '🎮 Next Stream Recommendations',
        ...this.generateRecommendations(analytics, metrics),
      ],
    };

    return Object.values(sections).flat().join('\n');
  }

  calculateStreamMetrics(timeline) {
    const metrics = {
      peakViewers: 0,
      avgViewers: 0,
      totalMessages: 0,
      uniqueChatters: new Set(),
      engagementRate: 0,
      overallMood: 'neutral',
      mostActiveHour: 0,
      topEmotes: [],
      hourlyActivity: new Map(),
      emotes: new Map(),
    };

    const viewerStats = {
      total: 0,
      count: 0,
    };

    const sentimentStats = {
      total: 0,
      count: 0,
    };

    timeline.forEach((event) => {
      this.processTimelineEvent(event, metrics, viewerStats, sentimentStats);
    });

    return this.finalizeMetrics(metrics, viewerStats, sentimentStats);
  }

  processTimelineEvent(event, metrics, viewerStats, sentimentStats) {
    if (event.type === 'viewers' && typeof event.data?.count === 'number') {
      viewerStats.total += event.data.count;
      viewerStats.count++;
      metrics.peakViewers = Math.max(metrics.peakViewers, event.data.count);
    } else if (event.type === 'chat') {
      this.processChatEvent(event, metrics, sentimentStats);
    }
  }

  processChatEvent(event, metrics, sentimentStats) {
    metrics.totalMessages++;
    metrics.uniqueChatters.add(event.username);

    const hour = new Date(event.timestamp).getHours();
    metrics.hourlyActivity.set(hour, (metrics.hourlyActivity.get(hour) || 0) + 1);

    this.processEmotes(event.data.message, metrics);

    if (typeof event.data.sentiment === 'number') {
      sentimentStats.total += event.data.sentiment;
      sentimentStats.count++;
    }
  }

  processEmotes(message, metrics) {
    const emotes = this.extractEmotes(message);
    emotes.forEach((emote) => {
      metrics.emotes.set(emote, (metrics.emotes.get(emote) || 0) + 1);
    });
  }

  finalizeMetrics(metrics, viewerStats, sentimentStats) {
    metrics.avgViewers = Math.round(viewerStats.total / Math.max(viewerStats.count, 1));
    metrics.engagementRate =
      metrics.totalMessages / Math.max(metrics.avgViewers * (viewerStats.count / 3600), 1);

    const hourlyActivityArray = Array.from(metrics.hourlyActivity.entries());
    metrics.mostActiveHour =
      hourlyActivityArray.length > 0
        ? hourlyActivityArray.reduce((max, curr) => (curr[1] > max[1] ? curr : max))[0]
        : 0;

    metrics.overallMood = this.getSentimentLabel(
      sentimentStats.total / Math.max(sentimentStats.count, 1)
    );
    metrics.topEmotes = this.getTopEmotes(metrics.emotes);

    return metrics;
  }

  async generateChatSummary(timeline) {
    const segments = this.segmentChatMessages(timeline);
    const moments = await this.analyzeChatSegments(segments);
    return { moments: moments.slice(0, CONSTANTS.MAX_HIGHLIGHTS) };
  }

  segmentChatMessages(timeline) {
    const segments = [];
    let currentSegment = [];
    let lastTimestamp = timeline[0]?.timestamp;

    timeline.forEach((event) => {
      if (event.type === 'chat') {
        if (!lastTimestamp || event.timestamp - lastTimestamp > CONSTANTS.SEGMENT_DURATION) {
          if (currentSegment.length > 0) {
            segments.push(currentSegment);
          }
          currentSegment = [];
        }
        currentSegment.push(event.data.message);
        lastTimestamp = event.timestamp;
      }
    });

    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }

    return segments;
  }

  async analyzeChatSegments(segments) {
    const analysisPromises = segments
      .filter((_, i) => i % 2 === 0)
      .map((segment) =>
        segment?.length ? AIService.analyzeMessage(segment.join(' '), 'summary') : null
      );

    const analyses = await Promise.allSettled(analysisPromises);
    return analyses
      .filter(
        (result) =>
          result.status === 'fulfilled' && result.value?.sentiment > CONSTANTS.ENGAGEMENT_THRESHOLD
      )
      .map((result, index) => `• ${this.summarizeSegment(segments[index * 2])}`);
  }

  generateInsights(analytics, metrics) {
    const insights = [];

    if (
      analytics?.predictions?.growth?.trend === 'growing' &&
      analytics?.predictions?.growth?.rate
    ) {
      insights.push(
        `• Viewer growth trend: +${Math.round(analytics.predictions.growth.rate * 100)}%`
      );
    }

    if (metrics?.engagementRate > CONSTANTS.ENGAGEMENT_THRESHOLD) {
      insights.push('• High chat engagement detected!');
    }

    if (analytics?.retention?.rate) {
      insights.push(`• Viewer retention rate: ${Math.round(analytics.retention.rate * 100)}%`);
    }

    if (metrics?.peakViewers && metrics?.avgViewers) {
      const peakToAvgRatio = metrics.peakViewers / metrics.avgViewers;
      if (peakToAvgRatio > CONSTANTS.PEAK_RATIO_THRESHOLD) {
        insights.push(
          `• Strong peak performance: ${Math.round((peakToAvgRatio - 1) * 100)}% above average`
        );
      }
    }

    return insights.length > 0 ? insights : ['• Stream data is still being collected'];
  }

  generateRecommendations(analytics, metrics) {
    const recommendations = [];

    if (metrics.engagementRate < CONSTANTS.ENGAGEMENT_THRESHOLD) {
      recommendations.push('• Consider more interactive segments to boost chat engagement');
    }

    if (Array.isArray(analytics?.recommendations)) {
      recommendations.push(...analytics.recommendations.map((r) => `• ${r.suggestion}`));
    }

    return recommendations;
  }

  extractEmotes(message) {
    return Array.from(message.matchAll(this.emoteRegex), (m) => m[0]);
  }

  getTopEmotes(emoteMap) {
    return Array.from(emoteMap.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([emote]) => emote);
  }

  getSentimentLabel(score) {
    const { VERY_POSITIVE, POSITIVE, VERY_NEGATIVE, NEGATIVE } = CONSTANTS.SENTIMENT_THRESHOLDS;

    if (score > VERY_POSITIVE) return 'Very Positive';
    if (score > POSITIVE) return 'Positive';
    if (score < VERY_NEGATIVE) return 'Very Negative';
    if (score < NEGATIVE) return 'Negative';
    return 'Neutral';
  }

  formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatHighlights(highlights) {
    return highlights
      .slice(0, CONSTANTS.MAX_HIGHLIGHTS)
      .map((h) => `• ${this.formatTimestamp(h.timestamp)}: ${h.triggers.join(', ')}`);
  }

  summarizeSegment(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
      return 'No messages in segment';
    }

    const significantMessage = messages.reduce(
      (best, current) => (current.length > best.length ? current : best),
      messages[0]
    );

    return significantMessage.length > CONSTANTS.MESSAGE_TRUNCATE_LENGTH
      ? `${significantMessage.substring(0, CONSTANTS.MESSAGE_TRUNCATE_LENGTH - 3)}...`
      : significantMessage;
  }
}

const streamSummary = new StreamSummary();
export default streamSummary;
