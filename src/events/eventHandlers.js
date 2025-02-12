import responseHandler from './responseHandler.js';
import advancedModeration from '../bot/advancedModeration.js';
import logger from './utils/logger.js';
import { client } from './bot.js';
import { LRUCache } from 'lru-cache';

/**
 * Custom error class for event handling errors
 */
class EventHandlingError extends Error {
  constructor(message, eventType, originalError) {
    super(message);
    this.name = 'EventHandlingError';
    this.eventType = eventType;
    this.originalError = originalError;
  }
}

/**
 * Handles Twitch chat events with rate limiting and caching
 */
class EventHandlers {
  constructor() {
    // Event queue and processing
    this.eventQueue = [];
    this.processing = false;
    this.batchSize = 5;
    this.processInterval = 100; // ms
    this.intervalId = null;
    this.isShuttingDown = false;

    // Cache for recent events
    this.eventCache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 5, // 5 minutes
      updateAgeOnGet: true,
      dispose: (key, value) => {
        logger.debug(`Cache entry expired: ${key}`);
      },
    });

    // Rate limiting using sliding window
    this.rateLimits = new Map();
    this.RATE_WINDOW = 60000; // 1 minute
    this.MAX_EVENTS = 100;

    // Bind event handlers
    this.processEventQueue = this.processEventQueue.bind(this);
    this.shutdown = this.shutdown.bind(this);
  }

  /**
   * Initialize event handlers and start processing
   */
  setupEventHandlers() {
    const handlers = {
      subscription: this.handleSubscription.bind(this),
      resub: this.handleResub.bind(this),
      raid: this.handleRaid.bind(this),
      follow: this.handleFollow.bind(this),
    };

    // Set up event listeners with error boundaries
    for (const [event, handler] of Object.entries(handlers)) {
      client.on(event, (...args) => {
        try {
          this.queueEvent(event, args, handler);
        } catch (error) {
          logger.error(new EventHandlingError(`Failed to queue ${event} event`, event, error));
        }
      });
    }

    // Start event processor
    this.intervalId = setInterval(this.processEventQueue, this.processInterval);

    // Setup shutdown handler
    process.on('SIGTERM', this.shutdown);
    process.on('SIGINT', this.shutdown);
  }

  /**
   * Gracefully shutdown the event handler
   */
  async shutdown() {
    logger.info('Shutting down event handler...');
    this.isShuttingDown = true;

    // Clear interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Process remaining events
    while (this.eventQueue.length > 0 && !this.processing) {
      await this.processEventQueue();
    }

    // Clear caches
    this.eventCache.clear();
    this.rateLimits.clear();

    logger.info('Event handler shutdown complete');
  }

  /**
   * Queue an event for processing
   */
  queueEvent(type, args, handler) {
    if (this.isShuttingDown) {
      logger.warn('Event handler is shutting down, not accepting new events');
      return;
    }

    const event = {
      type,
      args,
      handler,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 3,
    };
    this.eventQueue.push(event);
  }

  /**
   * Process events in the queue
   */
  async processEventQueue() {
    if (this.processing || this.eventQueue.length === 0) {
      return;
    }

    this.processing = true;
    try {
      const batch = this.eventQueue.splice(0, this.batchSize);
      await Promise.all(batch.map((event) => this.processEvent(event)));
    } catch (error) {
      logger.error(new EventHandlingError('Error processing event batch', 'batch', error));
    } finally {
      this.processing = false;
    }
  }

  /**
   * Process a single event with retry logic
   */
  async processEvent(event) {
    const { type, args, handler, timestamp, retryCount, maxRetries } = event;

    // Check rate limit
    if (!this.checkRateLimit(type)) {
      logger.warn(`Rate limit exceeded for ${type}`);
      if (retryCount < maxRetries) {
        event.retryCount++;
        setTimeout(() => this.eventQueue.push(event), 1000 * Math.pow(2, retryCount));
      }
      return;
    }

    // Check cache
    const cacheKey = this.getCacheKey(type, args);
    if (this.eventCache.has(cacheKey)) {
      return;
    }

    try {
      await handler(...args);
      this.eventCache.set(cacheKey, timestamp);
    } catch (error) {
      const eventError = new EventHandlingError(`Error handling ${type} event`, type, error);
      logger.error(eventError);

      if (retryCount < maxRetries) {
        event.retryCount++;
        setTimeout(() => this.eventQueue.push(event), 1000 * Math.pow(2, retryCount));
      }
    }
  }

  checkRateLimit(type) {
    const now = Date.now();
    const events = this.rateLimits.get(type) || [];

    // Remove old events
    const recent = events.filter((time) => now - time < this.RATE_WINDOW);
    this.rateLimits.set(type, recent);

    // Check limit
    if (recent.length >= this.MAX_EVENTS) {
      return false;
    }

    // Add new event
    recent.push(now);
    return true;
  }

  getCacheKey(type, args) {
    return `${type}:${JSON.stringify(args)}`;
  }

  async handleSubscription(channel, username, method, message, userstate) {
    await this.handleEvent('sub', channel, username, { method, message, userstate });
  }

  async handleResub(channel, username, months, message, userstate, methods) {
    await this.handleEvent('resub', channel, username, { months, message, userstate, methods });
  }

  async handleRaid(channel, username, viewers) {
    await this.handleEvent('raid', channel, username, { viewers });
    await advancedModeration.assessRaid(username, viewers);
  }

  async handleFollow(channel, username) {
    await this.handleEvent('follow', channel, username);
  }

  async handleEvent(type, channel, username, data = {}) {
    try {
      logger.info(`Processing ${type} event`, { username, data });
      const response = await responseHandler.generateEventResponse(type, username, data);
      if (response) {
        await client.say(channel, response);
      }
    } catch (error) {
      logger.error(`Error in ${type} event handler:`, error);
    }
  }
}

export default new EventHandlers();
