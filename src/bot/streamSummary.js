import logger from '../utils/logger.js';
import enhancedAnalytics from './enhancedAnalytics.js';
import contentManager from './contentManager.js';
import AIService from '../utils/aiService.js';

class StreamSummary {
  constructor() {
    this.aiService = new AIService();
  }

  async generateEndOfStreamSummary() {
    try {
      const analytics = enhancedAnalytics.getStreamPerformance();
      const highlights = contentManager.getRecentHighlights();
      const timeline = enhancedAnalytics.getEngagementTimeline('24h');

      // Get stream duration
      const streamStart = Math.min(...timeline.map((event) => event.timestamp));
      const duration = Math.floor((Date.now() - streamStart) / (1000 * 60)); // in minutes

      // Calculate key metrics
      const metrics = this.calculateStreamMetrics(timeline);

      // Generate AI summary of chat highlights
      const chatSummary = await this.generateChatSummary(timeline);

      // Format the summary
      const summary = [
        `📊 Stream Summary (${duration} minutes)`,
        '',
        '📈 Performance',
        `• Peak Viewers: ${metrics.peakViewers}`,
        `• Average Viewers: ${metrics.avgViewers}`,
        `• Chat Messages: ${metrics.totalMessages}`,
        `• Unique Chatters: ${metrics.uniqueChatters}`,
        `• Engagement Rate: ${Math.round(metrics.engagementRate * 100)}%`,
        '',
        '🎯 Highlights',
        ...highlights
          .slice(0, 5)
          .map((h) => `• ${this.formatTimestamp(h.timestamp)}: ${h.triggers.join(', ')}`),
        '',
        '💬 Chat Analysis',
        `• Overall Mood: ${metrics.overallMood}`,
        `• Most Active Hour: ${metrics.mostActiveHour}:00`,
        `• Top Emotes: ${metrics.topEmotes.join(', ')}`,
        '',
        '🏆 Top Moments',
        ...chatSummary.moments,
        '',
        '📝 Insights',
        ...this.generateInsights(analytics, metrics),
        '',
        '🎮 Next Stream Recommendations',
        ...this.generateRecommendations(analytics, metrics),
      ].join('\n');

      return summary;
    } catch (error) {
      logger.error('Error generating stream summary:', error);
      return 'Error generating stream summary';
    }
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

    let totalViewers = 0;
    let viewerSnapshots = 0;
    let totalSentiment = 0;
    let sentimentCount = 0;

    timeline.forEach((event) => {
      // Track viewers
      if (event.type === 'viewers') {
        totalViewers += event.data.count;
        viewerSnapshots++;
        metrics.peakViewers = Math.max(metrics.peakViewers, event.data.count);
      }

      // Track chat activity
      if (event.type === 'chat') {
        metrics.totalMessages++;
        metrics.uniqueChatters.add(event.username);

        // Track hourly activity
        const hour = new Date(event.timestamp).getHours();
        metrics.hourlyActivity.set(hour, (metrics.hourlyActivity.get(hour) || 0) + 1);

        // Track emotes
        const emotes = this.extractEmotes(event.data.message);
        emotes.forEach((emote) => {
          metrics.emotes.set(emote, (metrics.emotes.get(emote) || 0) + 1);
        });

        // Track sentiment
        if (event.data.sentiment) {
          totalSentiment += event.data.sentiment;
          sentimentCount++;
        }
      }
    });

    // Calculate averages and finalize metrics
    metrics.avgViewers = Math.round(totalViewers / (viewerSnapshots || 1));
    metrics.engagementRate =
      metrics.totalMessages / (metrics.avgViewers * (timeline.length / 3600) || 1);

    // Determine most active hour
    metrics.mostActiveHour =
      Array.from(metrics.hourlyActivity.entries()).sort(([, a], [, b]) => b - a)[0]?.[0] || 0;

    // Calculate overall mood
    const avgSentiment = totalSentiment / (sentimentCount || 1);
    metrics.overallMood = this.getSentimentLabel(avgSentiment);

    // Get top emotes
    metrics.topEmotes = Array.from(metrics.emotes.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([emote]) => emote);

    return metrics;
  }

  async generateChatSummary(timeline) {
    const chatMessages = timeline
      .filter((event) => event.type === 'chat')
      .map((event) => event.data.message);

    // Group messages into 15-minute segments
    const segments = [];
    let currentSegment = [];
    let lastTimestamp = timeline[0]?.timestamp;

    timeline.forEach((event) => {
      if (event.type === 'chat') {
        if (!lastTimestamp || event.timestamp - lastTimestamp > 15 * 60 * 1000) {
          if (currentSegment.length > 0) {
            segments.push(currentSegment);
          }
          currentSegment = [];
        }
        currentSegment.push(event.data.message);
        lastTimestamp = event.timestamp;
      }
    });

    // Analyze each segment for key moments
    const moments = [];
    const analysisPromises = segments
      .filter((_, i) => i % 2 === 0) // Sample every other segment
      .map((segment) => (segment ? AIService.analyzeMessage(segment.join(' '), 'summary') : null));

    const analyses = await Promise.all(analysisPromises);
    analyses.forEach((analysis, index) => {
      const segment = segments[index * 2];
      if (analysis && analysis.sentiment > 0.5) {
        moments.push(`• ${this.summarizeSegment(segment)}`);
      }
    });

    return {
      moments: moments.slice(0, 5),
    };
  }

  generateInsights(analytics, metrics) {
    const insights = [];

    // Growth insights
    if (analytics.predictions.growth.trend === 'growing') {
      insights.push(
        `• Viewer growth trend: +${Math.round(analytics.predictions.growth.rate * 100)}%`
      );
    }

    // Engagement insights
    if (metrics.engagementRate > 0.5) {
      insights.push('• High chat engagement rate');
    }

    // Content insights
    if (analytics.predictions.trends.topContent.length > 0) {
      insights.push(`• Most effective content: ${analytics.predictions.trends.topContent[0].type}`);
    }

    return insights;
  }

  generateRecommendations(analytics, metrics) {
    const recommendations = [];

    // Add recommendations based on performance
    if (metrics.engagementRate < 0.3) {
      recommendations.push('• Consider more interactive segments to boost chat engagement');
    }

    // Add recommendations from analytics
    const streamRecommendations = analytics.recommendations || [];
    recommendations.push(...streamRecommendations.map((r) => `• ${r.suggestion}`));

    return recommendations;
  }

  extractEmotes(message) {
    // Simple emote detection - could be enhanced
    const emoteRegex = /:\w+:|[\u{1F300}-\u{1F9FF}]/gu;
    return Array.from(message.matchAll(emoteRegex), (m) => m[0]);
  }

  getSentimentLabel(score) {
    if (score > 0.6) {
      return 'Very Positive';
    }
    if (score > 0.2) {
      return 'Positive';
    }
    if (score < -0.6) {
      return 'Very Negative';
    }
    if (score < -0.2) {
      return 'Negative';
    }
    return 'Neutral';
  }

  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  summarizeSegment(messages) {
    // Find the most representative message
    const significantMessage = messages.reduce(
      (best, current) => (current.length > best.length ? current : best),
      messages[0]
    );

    // Truncate if too long
    return significantMessage.length > 100
      ? `${significantMessage.substring(0, 97)}...`
      : significantMessage;
  }
}

const streamSummary = new StreamSummary();
export default streamSummary;
