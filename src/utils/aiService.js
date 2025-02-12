import { LRUCache } from 'lru-cache';
import { generateResponse, analyzeSentiment, DEFAULT_SYSTEM_PROMPT } from './ai.js';
import { generateResponse as generateAIResponse } from './gemini.js';  // Updated import
import logger from './logger.js';
import { CircuitBreaker } from './circuitBreaker.js';
import { sentimentHandler } from './sentimentHandler.js';

class AIService {
  constructor(options = {}) {
    const cacheOptions = {
      max: 1000,
      ttl: options.cacheTTL || 1000 * 60 * 30,
      updateAgeOnGet: true,
    };

    this.contextWindow = new LRUCache(cacheOptions);
    this.emotionPatterns = new LRUCache(cacheOptions);
    this.contentPreferences = new LRUCache(cacheOptions);
    this.analysisCache = new LRUCache({ ...cacheOptions, ttl: 1000 * 60 * 5 });

    this.MAX_CONTEXT = options.maxContext || 10;
    this.BATCH_SIZE = options.batchSize || 5;
    this.RATE_LIMIT = options.rateLimit || 10;
    this.analysisQueue = [];
    this.processingBatch = false;
    this.requestCount = 0;
    this.lastReset = Date.now();

    // Add circuit breaker for API calls
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: options.circuitBreakerOptions?.failureThreshold || 0.5,
      successThreshold: options.circuitBreakerOptions?.successThreshold || 0.5,
      timeout: options.circuitBreakerOptions?.timeout || 10000,
    });

    this.emotionCache = new Map();
    this.moodHistory = [];
    this.chatMood = {
      overall: 'neutral',
      score: 0,
      updated: Date.now(),
    };
  }

  async analyzeMessage(message, context = {}) {
    try {
      const sentiment = await sentimentHandler.analyzeMessage(message, context.username);
      return {
        ...sentiment,
        contextual: this.getMessageContext(context),
      };
    } catch (error) {
      logger.error('Error in message analysis:', error);
      return null;
    }
  }

  getMessageContext(context) {
    const channelMood = sentimentHandler.getChannelMoodSummary();
    const userMood = context.username ?
        sentimentHandler.getUserMoodSummary(context.username) : null;

    return {
        channelMood,
        userMood,
        timestamp: Date.now(),
    };
  }

  async processBatch() {
    if (this.processingBatch || this.analysisQueue.length === 0) {
      return;
    }

    this.processingBatch = true;
    const batch = this.analysisQueue.splice(0, this.BATCH_SIZE);

    try {
      const results = await Promise.all(
        batch.map(async ({ message, username, cacheKey }) => {
          const analysis = await analyzeSentiment(message);
          if (!analysis) {
            return null;
          }

          const result = {
            sentiment: analysis.toxicityScore,
            emotions: analysis.categories,
            timestamp: Date.now(),
          };

          this.analysisCache.set(cacheKey, result);
          this.updateUserContext(username, result);
          return result;
        })
      );

      this.incrementRequestCount(batch.length);
      return results;
    } catch (error) {
      logger.error('Batch processing failed:', error);
    } finally {
      this.processingBatch = false;

      // Process next batch if queue is not empty
      if (this.analysisQueue.length >= this.BATCH_SIZE) {
        setTimeout(() => this.processBatch(), 0);
      }
    }
  }

  isRateLimited() {
    const now = Date.now();
    if (now - this.lastReset > 60000) {
      this.requestCount = 0;
      this.lastReset = now;
    }
    return this.requestCount >= this.RATE_LIMIT;
  }

  incrementRequestCount(count = 1) {
    this.requestCount += count;
  }

  async generateResponse(message, username) {
    try {
      const context = this.getContextForUser(username);
      const systemPrompt = this.buildSystemPrompt(context);

      const response = await generateResponse(message, systemPrompt);
      if (!response) {
        throw new Error('Response generation failed');
      }

      return response;
    } catch (error) {
      logger.error('Response generation failed:', error);
      return null;
    }
  }

  updateUserContext(username, analysis) {
    const context = this.contextWindow.get(username) || [];
    context.push(analysis);

    if (context.length > this.MAX_CONTEXT) {
      context.shift();
    }

    this.contextWindow.set(username, context);
  }

  getContextForUser(username) {
    return this.contextWindow.get(username) || [];
  }

  buildSystemPrompt(context) {
    const emotions = this.analyzeEmotionTrends(context);

    return `${DEFAULT_SYSTEM_PROMPT}
Current context:
- Emotion trend: ${emotions.trend}
- Dominant emotion: ${emotions.dominant}
- Interaction count: ${context.length}`;
  }

  analyzeEmotionTrends(context) {
    if (!context.length) {
      return { trend: 'neutral', dominant: 'neutral' };
    }

    const recentEmotions = context.slice(-3);
    const emotionCounts = recentEmotions.reduce((acc, entry) => {
      Object.entries(entry.emotions).forEach(([emotion, value]) => {
        acc[emotion] = (acc[emotion] || 0) + value;
      });
      return acc;
    }, {});

    const dominant = Object.entries(emotionCounts).reduce(
      (max, [emotion, count]) => (count > max.count ? { emotion, count } : max),
      { emotion: 'neutral', count: 0 }
    ).emotion;

    const trend =
      recentEmotions[recentEmotions.length - 1]?.sentiment > 0.5 ? 'positive' : 'negative';

    return { trend, dominant };
  }

  async updateContentPreferences(username, message) {
    try {
      // Initialize user preferences if they don't exist
      if (!this.contentPreferences.has(username)) {
        this.contentPreferences.set(username, {
          topics: new Map(),
          patterns: [],
          lastAnalysis: null,
        });
      }

      // Get the message analysis
      const analysis = await this.analyzeMessage(message, username);
      if (!analysis) {
        return;
      }

      const userPrefs = this.contentPreferences.get(username);
      const extractedTopics = this.extractTopicsFromMessage(message);

      // Update topic frequencies
      extractedTopics.forEach((topic) => {
        const count = userPrefs.topics.get(topic) || 0;
        userPrefs.topics.set(topic, count + 1);
      });

      userPrefs.lastAnalysis = {
        sentiment: analysis.sentiment,
        timestamp: Date.now(),
      };

      this.contentPreferences.set(username, userPrefs);
    } catch (error) {
      logger.error('Error updating content preferences:', error);
    }
  }

  extractTopicsFromMessage(message) {
    // Improved topic extraction with basic NLP
    const words = message
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/);

    const topicPatterns = {
      gaming: /\b(game|play|stream|gaming)\b/,
      interaction: /\b(chat|thanks|hello|hi|hey)\b/,
      sentiment: /\b(love|hate|like|dislike)\b/,
      technical: /\b(bug|error|issue|problem)\b/,
    };

    const topics = new Set();

    // Check against patterns
    Object.entries(topicPatterns).forEach(([category, pattern]) => {
      if (pattern.test(message)) {
        topics.add(category);
      }
    });

    // Add individual matching words
    words.forEach((word) => {
      if (word.length > 3 && !this.isStopWord(word)) {
        topics.add(word);
      }
    });

    return Array.from(topics);
  }

  isStopWord(word) {
    const stopWords = new Set(['the', 'and', 'but', 'for', 'with', 'this', 'that']);
    return stopWords.has(word);
  }

  async analyzeMessageContent(message, context = {}) {
    try {
      const prompt = `Analyze this chat message for sentiment and emotion. Message: "${message}"
          Consider context: ${JSON.stringify(context)}
          Return as JSON with format:
          {
              "sentiment": number (-1 to 1),
              "emotion": string (primary emotion),
              "intensity": number (0 to 1),
              "mood": string (overall mood),
              "flags": array (any concerning patterns)
          }`;

      const response = await generateAIResponse(prompt);
      const analysis = JSON.parse(response);

      // Update mood history
      this.updateMoodHistory(analysis);

      return analysis;
    } catch (error) {
      logger.error('Error in message analysis:', error);
      return null;
    }
  }

  updateMoodHistory(analysis) {
    this.moodHistory.push({
      timestamp: Date.now(),
      sentiment: analysis.sentiment,
      emotion: analysis.emotion,
    });

    // Keep last hour of mood data
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.moodHistory = this.moodHistory.filter(m => m.timestamp > oneHourAgo);

    // Update overall chat mood
    this.updateChatMood();
  }

  updateChatMood() {
    if (this.moodHistory.length === 0) {
      return;
    }

    const recentMoods = this.moodHistory.slice(-10);
    const avgSentiment = recentMoods.reduce((sum, m) => sum + m.sentiment, 0) / recentMoods.length;

    this.chatMood = {
      overall: this.getSentimentLabel(avgSentiment),
      score: avgSentiment,
      updated: Date.now(),
    };
  }

  getSentimentLabel(score) {
    if (score > 0.5) { return 'very_positive'; }
    if (score > 0.1) { return 'positive'; }
    if (score < -0.5) { return 'very_negative'; }
    if (score < -0.1) { return 'negative'; }
    return 'neutral';
  }
}

export default AIService;
