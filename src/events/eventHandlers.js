import responseHandler from './responseHandler.js';
import advancedModeration from '../bot/advancedModeration.js';
import logger from './utils/logger.js';
import { client } from './bot.js';
import { LRUCache } from 'lru-cache';

class EventHandlers {
  constructor() {
    // Event queue and processing
    this.eventQueue = [];
    this.processing = false;
    this.batchSize = 5;
    this.processInterval = 100; // ms

    // Cache for recent events
    this.eventCache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 5, // 5 minutes
    });

    // Rate limiting
    this.rateLimits = new Map();
    this.RATE_WINDOW = 60000; // 1 minute
    this.MAX_EVENTS = 100;
  }

  setupEventHandlers() {
    // Event handler mappings
    const handlers = {
      subscription: this.handleSubscription.bind(this),
      resub: this.handleResub.bind(this),
      raid: this.handleRaid.bind(this),
      follow: this.handleFollow.bind(this),
    };

    // Set up event listeners
    for (const [event, handler] of Object.entries(handlers)) {
      client.on(event, (...args) => this.queueEvent(event, args, handler));
    }

    // Start event processor
    setInterval(() => this.processEventQueue(), this.processInterval);
  }

  queueEvent(type, args, handler) {
    const event = { type, args, handler, timestamp: Date.now() };
    this.eventQueue.push(event);
  }

  async processEventQueue() {
    if (this.processing || this.eventQueue.length === 0) {
      return;
    }

    this.processing = true;
    try {
      const batch = this.eventQueue.splice(0, this.batchSize);
      await Promise.all(batch.map((event) => this.processEvent(event)));
    } catch (error) {
      logger.error('Error processing event batch:', error);
    } finally {
      this.processing = false;
    }
  }

  async processEvent({ type, args, handler, timestamp }) {
    // Check rate limit
    if (!this.checkRateLimit(type)) {
      logger.warn(`Rate limit exceeded for ${type}`);
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
      logger.error(`Error handling ${type} event:`, error);
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
