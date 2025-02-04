import logger from '../utils/logger.js';
import aiService from '../utils/aiService.js';
import enhancedAnalytics from './enhancedAnalytics.js';

class ContentManager {
  constructor() {
    this.contentData = {
      highlights: [], // Array of detected highlight moments
      recommendations: new Map(), // content type -> recommendations
      contentCategories: new Set(), // Set of known content categories
      performanceMetrics: new Map(), // content ID -> performance metrics
      activeContent: null, // Currently active content
    };

    // Initialize with default content
    this.setActiveContent({
      type: 'stream',
      id: Date.now().toString(),
      category: ['stream'],
      startTime: Date.now(),
    });

    // Highlight detection thresholds
    this.highlightThresholds = {
      chatIntensity: 2.5, // Messages per second
      emoteFrequency: 0.7, // Ratio of messages with emotes
      cheerAmount: 100, // Minimum bits for highlight
      followSpike: 5, // Followers per minute
      clipCreation: 2, // Clips created per minute
    };

    this.startContentMonitoring();
  }

  setActiveContent(content) {
    this.contentData.activeContent = {
      ...content,
      startTime: content.startTime || Date.now(),
    };
    logger.debug('Set active content:', this.contentData.activeContent);
  }

  startContentMonitoring() {
    setInterval(
      () => {
        this.analyzeCurrentContent();
        this.generateRecommendations();
        this.cleanupOldData();
      },
      5 * 60 * 1000
    ); // Run every 5 minutes
  }

  async analyzeCurrentContent() {
    try {
      if (!this.contentData.activeContent) {
        return;
      }

      const metrics = {
        chatIntensity: 0,
        emoteFrequency: 0,
        cheerAmount: 0,
        followCount: 0,
        clipCount: 0,
        duration: (Date.now() - this.contentData.activeContent.startTime) / 1000,
      };

      // Track performance of current content
      this.trackContentPerformance({
        type: this.contentData.activeContent.type,
        id: this.contentData.activeContent.id,
        category: this.contentData.activeContent.category,
        metrics,
      });

      logger.debug('Content analysis completed', {
        contentId: this.contentData.activeContent.id,
        metrics,
      });
    } catch (error) {
      logger.error('Error analyzing current content:', error);
    }
  }

  async detectHighlight(events) {
    try {
      const now = Date.now();
      const window = 60000; // 1 minute window
      const relevantEvents = events.filter((e) => now - e.timestamp < window);

      if (relevantEvents.length === 0) {
        return null;
      }

      // Calculate metrics
      const metrics = {
        chatIntensity: this.calculateChatIntensity(relevantEvents),
        emoteFrequency: this.calculateEmoteFrequency(relevantEvents),
        cheerAmount: this.calculateCheerAmount(relevantEvents),
        followCount: this.calculateFollowCount(relevantEvents),
        clipCount: this.calculateClipCount(relevantEvents),
      };

      // Check if any threshold is exceeded
      const triggers = [];
      if (metrics.chatIntensity > this.highlightThresholds.chatIntensity) {
        triggers.push('High chat activity');
      }
      if (metrics.emoteFrequency > this.highlightThresholds.emoteFrequency) {
        triggers.push('Emote spam');
      }
      if (metrics.cheerAmount > this.highlightThresholds.cheerAmount) {
        triggers.push('Significant cheering');
      }
      if (metrics.followCount > this.highlightThresholds.followSpike) {
        triggers.push('Follow spike');
      }
      if (metrics.clipCount > this.highlightThresholds.clipCreation) {
        triggers.push('Multiple clips created');
      }

      if (triggers.length > 0) {
        const highlight = {
          timestamp: now,
          triggers,
          metrics,
          events: relevantEvents,
        };

        this.contentData.highlights.push(highlight);
        await this.analyzeHighlight(highlight);
        return highlight;
      }

      return null;
    } catch (error) {
      logger.error('Error detecting highlight:', error);
      return null;
    }
  }

  calculateChatIntensity(events) {
    const chatEvents = events.filter((e) => e.type === 'chat');
    return chatEvents.length / 60; // Messages per second
  }

  calculateEmoteFrequency(events) {
    const chatEvents = events.filter((e) => e.type === 'chat');
    if (chatEvents.length === 0) {
      return 0;
    }

    const emoteMessages = chatEvents.filter(
      (e) =>
        e.data.message.match(/[\u{1F300}-\u{1F9FF}]/u) || // Unicode emotes
        e.data.message.includes(':') // Twitch emotes (basic check)
    );

    return emoteMessages.length / chatEvents.length;
  }

  calculateCheerAmount(events) {
    return events.filter((e) => e.type === 'cheer').reduce((sum, e) => sum + e.data.bits, 0);
  }

  calculateFollowCount(events) {
    return events.filter((e) => e.type === 'follow').length;
  }

  calculateClipCount(events) {
    return events.filter((e) => e.type === 'clip').length;
  }

  async analyzeHighlight(highlight) {
    try {
      // Get chat messages during highlight
      const chatMessages = highlight.events
        .filter((e) => e.type === 'chat')
        .map((e) => e.data.message);

      // Analyze chat sentiment during highlight
      const sentiments = await Promise.all(
        chatMessages.map((msg) => aiService.analyzeMessage(msg))
      );

      const averageSentiment =
        sentiments.reduce((sum, s) => sum + (s ? s.sentiment : 0), 0) / sentiments.length;

      // Categorize the highlight
      const category = this.categorizeHighlight(highlight, averageSentiment);

      // Update highlight with analysis
      highlight.analysis = {
        sentiment: averageSentiment,
        category,
        intensity: this.calculateHighlightIntensity(highlight),
      };

      // Track performance metrics
      this.trackContentPerformance({
        type: 'highlight',
        id: highlight.timestamp.toString(),
        category,
        metrics: highlight.metrics,
      });

      return highlight.analysis;
    } catch (error) {
      logger.error('Error analyzing highlight:', error);
      return null;
    }
  }

  categorizeHighlight(highlight, sentiment) {
    const categories = new Set();

    // Check triggers
    highlight.triggers.forEach((trigger) => {
      if (trigger.includes('chat')) {
        categories.add('chat');
      }
      if (trigger.includes('clip')) {
        categories.add('gameplay');
      }
      if (trigger.includes('cheer')) {
        categories.add('donation');
      }
      if (trigger.includes('follow')) {
        categories.add('growth');
      }
    });

    // Check sentiment
    if (sentiment > 0.7) {
      categories.add('positive');
    }
    if (sentiment < -0.3) {
      categories.add('negative');
    }

    // Check intensity
    if (this.calculateHighlightIntensity(highlight) > 0.8) {
      categories.add('intense');
    }

    return Array.from(categories);
  }

  calculateHighlightIntensity(highlight) {
    const weights = {
      chatIntensity: 0.3,
      emoteFrequency: 0.2,
      cheerAmount: 0.2,
      followCount: 0.15,
      clipCount: 0.15,
    };

    let intensity = 0;
    for (const [metric, weight] of Object.entries(weights)) {
      const value = highlight.metrics[metric];
      const threshold = this.highlightThresholds[metric];
      intensity += (value / threshold) * weight;
    }

    return Math.min(1, intensity);
  }

  async generateRecommendations() {
    try {
      // Get recent performance data
      const performance = Array.from(this.contentData.performanceMetrics.values())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50); // Last 50 content items

      // Group by category
      const categoryPerformance = new Map();
      for (const item of performance) {
        for (const category of item.categories) {
          if (!categoryPerformance.has(category)) {
            categoryPerformance.set(category, []);
          }
          categoryPerformance.get(category).push(item);
        }
      }

      // Generate recommendations for each category
      const recommendations = new Map();
      for (const [category, items] of categoryPerformance.entries()) {
        const avgEngagement = items.reduce((sum, item) => sum + item.engagement, 0) / items.length;
        const trending = avgEngagement > 0.7;

        recommendations.set(category, {
          trending,
          confidence: Math.min(1, items.length / 10),
          suggestions: this.generateCategorySuggestions(category, items),
        });
      }

      this.contentData.recommendations = recommendations;
      return recommendations;
    } catch (error) {
      logger.error('Error generating recommendations:', error);
      return new Map();
    }
  }

  generateCategorySuggestions(category, items) {
    const suggestions = [];
    const engagement = items.reduce((sum, item) => sum + item.engagement, 0) / items.length;

    if (engagement < 0.5) {
      suggestions.push({
        type: 'improvement',
        message: `Consider increasing ${category} content interaction`,
        confidence: 0.7,
      });
    }

    if (engagement > 0.8) {
      suggestions.push({
        type: 'leverage',
        message: `Capitalize on high ${category} engagement`,
        confidence: 0.9,
      });
    }

    // Add timing suggestions based on performance patterns
    const timeAnalysis = this.analyzeContentTiming(items);
    if (timeAnalysis.bestTime) {
      suggestions.push({
        type: 'timing',
        message: `Optimal time for ${category} content: ${timeAnalysis.bestTime}`,
        confidence: timeAnalysis.confidence,
      });
    }

    return suggestions;
  }

  analyzeContentTiming(items) {
    if (items.length < 5) {
      return { confidence: 0 };
    }

    // Group by hour of day
    const hourlyPerformance = new Map();
    for (const item of items) {
      const hour = new Date(item.timestamp).getHours();
      if (!hourlyPerformance.has(hour)) {
        hourlyPerformance.set(hour, []);
      }
      hourlyPerformance.get(hour).push(item.engagement);
    }

    // Find best performing hour
    let bestHour = 0;
    let bestEngagement = 0;
    for (const [hour, engagements] of hourlyPerformance.entries()) {
      const avg = engagements.reduce((sum, e) => sum + e, 0) / engagements.length;
      if (avg > bestEngagement) {
        bestEngagement = avg;
        bestHour = hour;
      }
    }

    return {
      bestTime: `${bestHour}:00`,
      confidence: Math.min(1, hourlyPerformance.get(bestHour).length / 10),
    };
  }

  trackContentPerformance(content) {
    const metrics = {
      timestamp: Date.now(),
      type: content.type,
      id: content.id,
      categories: content.category,
      engagement: this.calculateEngagement(content.metrics),
      performance: content.metrics,
    };

    this.contentData.performanceMetrics.set(content.id, metrics);
    this.contentData.contentCategories.add(content.type);

    // Update analytics
    enhancedAnalytics.trackContentEffectiveness({
      type: content.type,
      engagement: metrics.engagement,
      retention: content.metrics.duration || 0,
    });
  }

  calculateEngagement(metrics) {
    // Normalize and combine different engagement metrics
    const normalized = {
      chatIntensity: metrics.chatIntensity / this.highlightThresholds.chatIntensity,
      emoteFrequency: metrics.emoteFrequency / this.highlightThresholds.emoteFrequency,
      cheerAmount: metrics.cheerAmount / this.highlightThresholds.cheerAmount,
      followCount: metrics.followCount / this.highlightThresholds.followSpike,
      clipCount: metrics.clipCount / this.highlightThresholds.clipCreation,
    };

    return (
      Object.values(normalized).reduce((sum, value) => sum + value, 0) /
      Object.keys(normalized).length
    );
  }

  getRecentHighlights(limit = 10) {
    return this.contentData.highlights.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  getContentRecommendations() {
    return {
      categories: Array.from(this.contentData.recommendations.entries()),
      highlights: this.getRecentHighlights(5),
      trending: this.getTrendingContent(),
    };
  }

  getTrendingContent() {
    return Array.from(this.contentData.performanceMetrics.values())
      .filter((m) => Date.now() - m.timestamp < 24 * 3600000) // Last 24 hours
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 5);
  }

  cleanupOldData() {
    const now = Date.now();
    const ONE_DAY = 24 * 3600000;

    // Keep highlights from last 24 hours
    this.contentData.highlights = this.contentData.highlights.filter(
      (h) => now - h.timestamp < ONE_DAY
    );

    // Keep performance metrics from last 7 days
    for (const [id, metrics] of this.contentData.performanceMetrics.entries()) {
      if (now - metrics.timestamp > 7 * ONE_DAY) {
        this.contentData.performanceMetrics.delete(id);
      }
    }
  }
}

const contentManager = new ContentManager();
export default contentManager;
