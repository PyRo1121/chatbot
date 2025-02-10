import logger from '../utils/logger.js';
import aiService from '../utils/aiService.js';

class EnhancedAnalytics {
  constructor() {
    this.analyticsData = {
      streamPerformance: new Map(), // timestamp -> performance metrics
      contentEffectiveness: new Map(), // content type -> effectiveness metrics
      engagementTimeline: [], // Array of engagement events
      viewerRetention: new Map(), // username -> retention metrics
      streamHealth: {
        current: {
          status: 'healthy',
          metrics: {},
        },
        history: [],
      },
      predictions: {
        growth: [],
        performance: [],
        trends: [],
      },
    };

    // Performance thresholds
    this.thresholds = {
      engagement: {
        low: 0.2,
        medium: 0.5,
        high: 0.8,
      },
      retention: {
        low: 0.3,
        medium: 0.6,
        high: 0.85,
      },
    };

    this.startPeriodicAnalysis();
    this.aiService = new aiService();
  }

  startPeriodicAnalysis() {
    setInterval(
      () => {
        this.analyzeStreamHealth();
        this.generatePredictions();
        this.cleanupOldData();
      },
      5 * 60 * 1000
    ); // Run every 5 minutes
  }

  async trackEngagement(event) {
    try {
      const timestamp = Date.now();

      // Add event to timeline
      this.analyticsData.engagementTimeline.push({
        timestamp,
        type: event.type,
        username: event.username,
        data: event.data,
      });

      // Update viewer retention
      if (event.username) {
        const retention = this.analyticsData.viewerRetention.get(event.username) || {
          firstSeen: timestamp,
          lastSeen: timestamp,
          sessions: [],
          interactions: [],
        };

        retention.lastSeen = timestamp;
        retention.interactions.push({
          timestamp,
          type: event.type,
        });

        // Detect session boundaries (30 minute gap)
        const lastSession = retention.sessions[retention.sessions.length - 1];
        if (!lastSession || timestamp - lastSession.end > 30 * 60 * 1000) {
          retention.sessions.push({
            start: timestamp,
            end: timestamp,
          });
        } else {
          lastSession.end = timestamp;
        }

        this.analyticsData.viewerRetention.set(event.username, retention);
      }

      // Update stream performance
      const performance = this.analyticsData.streamPerformance.get(timestamp) || {
        viewers: 0,
        chatActivity: 0,
        engagement: 0,
      };

      switch (event.type) {
        case 'chat':
          performance.chatActivity++;
          // Analyze chat sentiment
          if (event.data?.message) {
            const analysis = await this.aiService.analyzeMessage(
              event.data.message,
              event.username
            );

            if (analysis) {
              performance.sentiment = analysis.sentiment;
              performance.emotions = analysis.emotions;
            }
          }
          break;
        case 'follow':
        case 'subscribe':
        case 'cheer':
          performance.engagement++;
          break;
      }

      this.analyticsData.streamPerformance.set(timestamp, performance);

      // Track content effectiveness if content-related event
      if (event.type === 'content') {
        this.trackContentEffectiveness(event.data);
      }

      return true;
    } catch (error) {
      logger.error('Error tracking engagement:', error);
      return false;
    }
  }

  async trackContentEffectiveness(content) {
    try {
      const effectiveness = this.analyticsData.contentEffectiveness.get(content.type) || {
        impressions: 0,
        engagement: 0,
        retention: 0,
        feedback: [],
      };

      effectiveness.impressions++;

      if (content.engagement) {
        effectiveness.engagement += content.engagement;
      }

      if (content.retention) {
        effectiveness.retention =
          (effectiveness.retention * (effectiveness.impressions - 1) + content.retention) /
          effectiveness.impressions;
      }

      if (content.feedback) {
        effectiveness.feedback.push({
          timestamp: Date.now(),
          score: content.feedback,
        });
      }

      this.analyticsData.contentEffectiveness.set(content.type, effectiveness);

      return true;
    } catch (error) {
      logger.error('Error tracking content effectiveness:', error);
      return false;
    }
  }

  analyzeStreamHealth() {
    try {
      const now = Date.now();
      const lastHour = Array.from(this.analyticsData.streamPerformance.entries()).filter(
        ([timestamp]) => now - timestamp < 3600000
      );

      if (lastHour.length === 0) {
        return;
      }

      const metrics = {
        averageViewers:
          lastHour.reduce((sum, [_, data]) => sum + data.viewers, 0) / lastHour.length,
        chatActivity: lastHour.reduce((sum, [_, data]) => sum + data.chatActivity, 0),
        engagement: lastHour.reduce((sum, [_, data]) => sum + data.engagement, 0) / lastHour.length,
        sentiment:
          lastHour.reduce((sum, [_, data]) => sum + (data.sentiment || 0), 0) / lastHour.length,
      };

      const health = {
        status: this.calculateHealthStatus(metrics),
        timestamp: now,
        metrics,
      };

      this.analyticsData.streamHealth.current = health;
      this.analyticsData.streamHealth.history.push(health);

      return health;
    } catch (error) {
      logger.error('Error analyzing stream health:', error);
      return null;
    }
  }

  calculateHealthStatus(metrics) {
    const scores = {
      viewers: metrics.averageViewers > 0 ? 1 : 0,
      chat: metrics.chatActivity > 10 ? 1 : 0.5,
      engagement: metrics.engagement > this.thresholds.engagement.medium ? 1 : 0.5,
      sentiment: metrics.sentiment > 0 ? 1 : metrics.sentiment > -0.3 ? 0.5 : 0,
    };

    const overallScore = Object.values(scores).reduce((sum, score) => sum + score, 0) / 4;

    if (overallScore > 0.8) {
      return 'healthy';
    }
    if (overallScore > 0.5) {
      return 'moderate';
    }
    return 'concerning';
  }

  async generatePredictions() {
    try {
      const now = Date.now();
      const recentPerformance = Array.from(this.analyticsData.streamPerformance.entries()).filter(
        ([timestamp]) => now - timestamp < 24 * 3600000
      ); // Last 24 hours

      if (recentPerformance.length < 10) {
        return null;
      }

      // Calculate growth trends
      const growthTrend = this.calculateGrowthTrend(recentPerformance);

      // Predict next hour performance
      const predictedPerformance = this.predictPerformance(recentPerformance);

      // Identify content trends
      const contentTrends = this.analyzeContentTrends();

      const predictions = {
        timestamp: now,
        growth: growthTrend,
        performance: predictedPerformance,
        trends: contentTrends,
      };

      this.analyticsData.predictions.growth.push(growthTrend);
      this.analyticsData.predictions.performance.push(predictedPerformance);
      this.analyticsData.predictions.trends.push(contentTrends);

      return predictions;
    } catch (error) {
      logger.error('Error generating predictions:', error);
      return null;
    }
  }

  calculateGrowthTrend(performance) {
    const viewerCounts = performance.map(([_, data]) => data.viewers);
    const periods = Math.min(6, Math.floor(viewerCounts.length / 4));
    const averages = [];

    for (let i = 0; i < periods; i++) {
      const start = Math.floor((i * viewerCounts.length) / periods);
      const end = Math.floor(((i + 1) * viewerCounts.length) / periods);
      const average =
        viewerCounts.slice(start, end).reduce((sum, count) => sum + count, 0) / (end - start);
      averages.push(average);
    }

    const growth =
      averages.length > 1 ? (averages[averages.length - 1] - averages[0]) / averages[0] : 0;

    return {
      rate: growth,
      trend: growth > 0.1 ? 'growing' : growth < -0.1 ? 'declining' : 'stable',
      confidence: Math.min(1, performance.length / 100),
    };
  }

  predictPerformance(performance) {
    const recent = performance.slice(-12); // Last hour (5-minute intervals)
    const metrics = recent.map(([_, data]) => ({
      viewers: data.viewers,
      engagement: data.engagement,
      chatActivity: data.chatActivity,
      sentiment: data.sentiment || 0,
    }));

    // Simple moving average prediction
    const predicted = {
      viewers: 0,
      engagement: 0,
      chatActivity: 0,
      sentiment: 0,
    };

    for (const metric of Object.keys(predicted)) {
      const values = metrics.map((m) => m[metric]);
      const trend =
        values.reduce((sum, val, i) => sum + val * (i + 1), 0) /
        values.reduce((sum, _, i) => sum + (i + 1), 0);
      predicted[metric] = Math.max(metric === 'sentiment' ? -1 : 0, trend);
    }

    return {
      metrics: predicted,
      confidence: Math.min(1, performance.length / 100),
    };
  }

  analyzeContentTrends() {
    const trends = Array.from(this.analyticsData.contentEffectiveness.entries())
      .map(([type, data]) => ({
        type,
        effectiveness: data.engagement / data.impressions,
        retention: data.retention,
        feedback:
          data.feedback.length > 0
            ? data.feedback.reduce((sum, f) => sum + f.score, 0) / data.feedback.length
            : 0,
      }))
      .sort((a, b) => b.effectiveness - a.effectiveness);

    return {
      topContent: trends.slice(0, 3),
      recommendations: this.generateContentRecommendations(trends),
    };
  }

  generateContentRecommendations(trends) {
    const recommendations = [];

    // Find underperforming content
    const lowPerforming = trends.filter((t) => t.effectiveness < this.thresholds.engagement.medium);
    if (lowPerforming.length > 0) {
      recommendations.push({
        type: 'improvement',
        content: lowPerforming.map((t) => t.type),
        suggestion: 'Consider revising or replacing this content',
      });
    }

    // Find high-performing content
    const highPerforming = trends.filter((t) => t.effectiveness > this.thresholds.engagement.high);
    if (highPerforming.length > 0) {
      recommendations.push({
        type: 'leverage',
        content: highPerforming.map((t) => t.type),
        suggestion: 'Create more content similar to these successful types',
      });
    }

    return recommendations;
  }

  getEngagementTimeline(period = '1h') {
    const now = Date.now();
    let cutoff;

    switch (period) {
      case '1h':
        cutoff = now - 3600000;
        break;
      case '24h':
        cutoff = now - 86400000;
        break;
      case '7d':
        cutoff = now - 604800000;
        break;
      default:
        cutoff = now - 3600000;
    }

    return this.analyticsData.engagementTimeline
      .filter((event) => event.timestamp > cutoff)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  getStreamPerformance() {
    return {
      current: this.analyticsData.streamHealth.current,
      predictions: {
        growth:
          this.analyticsData.predictions.growth[this.analyticsData.predictions.growth.length - 1],
        performance:
          this.analyticsData.predictions.performance[
            this.analyticsData.predictions.performance.length - 1
          ],
        trends:
          this.analyticsData.predictions.trends[this.analyticsData.predictions.trends.length - 1],
      },
      recommendations: this.generateStreamRecommendations(),
    };
  }

  generateStreamRecommendations() {
    const recommendations = [];
    const health = this.analyticsData.streamHealth.current;

    if (health.status === 'concerning') {
      recommendations.push({
        priority: 'high',
        type: 'engagement',
        suggestion: 'Increase viewer interaction through polls or chat games',
      });
    }

    const retention =
      Array.from(this.analyticsData.viewerRetention.values()).reduce(
        (avg, data) => avg + (data.sessions.length > 1 ? 1 : 0),
        0
      ) / this.analyticsData.viewerRetention.size;

    if (retention < this.thresholds.retention.medium) {
      recommendations.push({
        priority: 'medium',
        type: 'retention',
        suggestion: 'Consider implementing viewer loyalty rewards or regular schedule',
      });
    }

    return recommendations;
  }

  cleanupOldData() {
    const now = Date.now();
    const ONE_DAY = 86400000;

    // Keep only last 24 hours of performance data
    for (const [timestamp] of this.analyticsData.streamPerformance) {
      if (now - timestamp > ONE_DAY) {
        this.analyticsData.streamPerformance.delete(timestamp);
      }
    }

    // Keep only last 100 health records
    if (this.analyticsData.streamHealth.history.length > 100) {
      this.analyticsData.streamHealth.history = this.analyticsData.streamHealth.history.slice(-100);
    }

    // Keep only last 50 predictions
    ['growth', 'performance', 'trends'].forEach((type) => {
      if (this.analyticsData.predictions[type].length > 50) {
        this.analyticsData.predictions[type] = this.analyticsData.predictions[type].slice(-50);
      }
    });

    // Clean up engagement timeline older than 7 days
    this.analyticsData.engagementTimeline = this.analyticsData.engagementTimeline.filter(
      (event) => now - event.timestamp < 7 * ONE_DAY
    );
  }
}

const enhancedAnalytics = new EnhancedAnalytics();
export default enhancedAnalytics;
