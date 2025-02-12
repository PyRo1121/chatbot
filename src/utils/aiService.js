import { LRUCache } from 'lru-cache';
import { generateResponse, analyzeSentiment, DEFAULT_SYSTEM_PROMPT } from './ai.js';
import logger from './logger.js';
import { CircuitBreaker } from './circuitBreaker.js';

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
  }

  async analyzeMessage(message, username) {
    try {
      const cacheKey = `${username}:${message}`;
      const cachedAnalysis = this.analysisCache.get(cacheKey);
      if (cachedAnalysis) {
        logger.debug('Cache hit:', { username, message });
        return cachedAnalysis;
      }

      if (this.isRateLimited()) {
        logger.warn('Rate limit reached for analysis');
        return null;
      }

      if (!this.processingBatch) {
        this.analysisQueue.push({ message, username, cacheKey });
        if (this.analysisQueue.length >= this.BATCH_SIZE) {
          await this.processBatch();
        }
        return null;
      }

      // Use circuit breaker for API calls
      const analysis = await this.circuitBreaker.execute(() => analyzeSentiment(message));
      if (!analysis) {
        throw new Error('Sentiment analysis failed');
      }

      this.incrementRequestCount();

      const result = {
        sentiment: analysis.toxicityScore,
        emotions: analysis.categories,
        timestamp: Date.now(),
      };

      this.analysisCache.set(cacheKey, result);
      this.updateUserContext(username, result);

      return result;
    } catch (error) {
      logger.error('Analysis failed:', error);
      return null;
    }
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
}

export default AIService;
