import { LRUCache } from 'lru-cache';
import { generateResponse, analyzeSentiment, DEFAULT_SYSTEM_PROMPT } from './ai.js';
import logger from './logger.js';

class AIService {
  constructor(options = {}) {
    const cacheOptions = {
      max: 1000,
      ttl: 1000 * 60 * 30,
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
  }

  async analyzeMessage(message, username) {
    try {
      const cacheKey = `${username}:${message}`;
      const cachedAnalysis = this.analysisCache.get(cacheKey);
      if (cachedAnalysis) {
        logger.debug('Cache hit:', { username, message });
        return cachedAnalysis;
      }

      const analysis = await analyzeSentiment(message);
      if (!analysis) {
        throw new Error('Sentiment analysis failed');
      }

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
}

export default AIService;
