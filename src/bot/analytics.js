import { LRUCache } from 'lru-cache';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import logger from '../utils/logger.js';

class Analytics {
  constructor() {
    // Cache configuration
    this.cache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 5, // 5 minutes
      updateAgeOnGet: true,
    });

    // Batch processing
    this.batchQueue = [];
    this.BATCH_SIZE = 50;
    this.PROCESSING_INTERVAL = 5000; // 5 seconds
    this.MAX_QUEUE_SIZE = 1000;

    // Core data structures
    this.analyticsData = null;
    this.currentStream = this.getEmptyStream();
    this.writeQueue = [];
    this.lastWrite = Date.now();
    this.writing = false;

    // File paths
    this.dataPath = join(process.cwd(), 'data', 'analytics.json');
    this.backupPath = join(process.cwd(), 'data', 'analytics.backup.json');

    // Initialize system
    this.initialize();

    // Setup auto-save and processing
    this.setupIntervals();
  }

  setupIntervals() {
    setInterval(() => this.processWrites(), this.PROCESSING_INTERVAL);
    setInterval(() => this.processBatch(), this.PROCESSING_INTERVAL);
    setInterval(() => this.cleanup(), 1000 * 60 * 60); // Hourly cleanup
  }

  getEmptyStream() {
    return {
      startTime: null,
      endTime: null,
      viewers: [],
      chatMessages: 0,
      commands: new Map(),
      highlights: [],
      raids: [],
      metrics: {
        peakViewers: 0,
        averageViewers: 0,
        chattersPerMinute: 0,
        uniqueChatters: new Set(),
        commandUsage: new Map(),
        categoryDuration: new Map(),
        engagementScore: 0,
      },
    };
  }

  async initialize() {
    try {
      await this.loadData();
      this.currentStream = this.getEmptyStream();
      this.currentStream.startTime = Date.now();
      logger.info('Analytics system initialized');
    } catch (error) {
      logger.error('Failed to initialize analytics:', error);
      this.analyticsData = { streamHistory: [] };
    }
  }

  async loadData() {
    try {
      const data = await readFile(this.dataPath, 'utf8');
      this.analyticsData = JSON.parse(data);
    } catch (error) {
      logger.warn('No existing analytics data found, creating new');
      this.analyticsData = { streamHistory: [] };
    }
  }

  startStream() {
    try {
      // Reset current stream
      this.currentStream = this.getEmptyStream();
      this.currentStream.startTime = Date.now();

      // Initialize stream metrics
      this.currentStream.metrics = {
        peakViewers: 0,
        averageViewers: 0,
        chattersPerMinute: 0,
        uniqueChatters: new Set(),
        commandUsage: new Map(),
        categoryDuration: new Map(),
        engagementScore: 0,
      };

      logger.info('Stream analytics started');
      return this.currentStream;
    } catch (error) {
      logger.error('Failed to start stream analytics:', error);
      throw error;
    }
  }

  queueMetric(type, data) {
    this.batchQueue.push({ type, data, timestamp: Date.now() });

    if (this.batchQueue.length >= this.BATCH_SIZE) {
      this.processBatch();
    }

    // Prevent queue from growing too large
    if (this.batchQueue.length > this.MAX_QUEUE_SIZE) {
      this.batchQueue = this.batchQueue.slice(-this.MAX_QUEUE_SIZE);
      logger.warn('Analytics queue truncated due to size limit');
    }
  }

  async processBatch() {
    if (!this.batchQueue.length) {
      return;
    }

    const batch = this.batchQueue.splice(0, this.BATCH_SIZE);

    try {
      await Promise.all(batch.map((item) => this.processMetric(item)));
      this.updateCache();
    } catch (error) {
      logger.error('Error processing metrics batch:', error);
    }
  }

  processMetric({ type, data }) {
    switch (type) {
      case 'viewer':
        this.updateViewerMetrics(data);
        break;
      case 'chat':
        this.updateChatMetrics(data);
        break;
      case 'command':
        this.updateCommandMetrics(data);
        break;
      case 'raid':
        this.updateRaidMetrics(data);
        break;
    }
    this.queueWrite();
  }

  updateViewerMetrics(data) {
    const { username, action } = data;
    const { viewers } = this.currentStream;

    if (action === 'join') {
      if (!viewers.includes(username)) {
        viewers.push(username);
      }
      this.updatePeakViewers();
    } else if (action === 'leave') {
      const index = viewers.indexOf(username);
      if (index > -1) {
        viewers.splice(index, 1);
      }
    }
  }

  updatePeakViewers() {
    const currentViewers = this.currentStream.viewers.length;
    if (currentViewers > this.currentStream.metrics.peakViewers) {
      this.currentStream.metrics.peakViewers = currentViewers;
    }
  }

  updateChatMetrics(data) {
    const { username, message } = data;
    this.currentStream.chatMessages++;
    this.currentStream.metrics.uniqueChatters.add(username);
    this.updateEngagementScore();
  }

  updateCommandMetrics(data) {
    const { command, username } = data;
    const { commands } = this.currentStream;
    commands.set(command, (commands.get(command) || 0) + 1);

    const { commandUsage } = this.currentStream.metrics;
    commandUsage.set(username, (commandUsage.get(username) || 0) + 1);
  }

  updateRaidMetrics(data) {
    this.currentStream.raids.push({
      ...data,
      timestamp: Date.now(),
    });
  }

  updateEngagementScore() {
    const { chatMessages, metrics } = this.currentStream;
    const streamDuration = (Date.now() - this.currentStream.startTime) / (1000 * 60); // minutes
    metrics.chattersPerMinute = chatMessages / streamDuration;

    metrics.engagementScore = Math.round(
      metrics.chattersPerMinute * 0.4 +
        metrics.uniqueChatters.size * 0.4 +
        this.currentStream.raids.length * 0.2
    );
  }

  async processWrites() {
    if (this.writing || !this.writeQueue.length) {
      return;
    }

    this.writing = true;
    try {
      // Backup current data
      await writeFile(this.backupPath, JSON.stringify(this.analyticsData));

      // Write updated data
      await writeFile(this.dataPath, JSON.stringify(this.analyticsData));

      this.writeQueue = [];
      this.lastWrite = Date.now();
    } catch (error) {
      logger.error('Failed to write analytics data:', error);
    } finally {
      this.writing = false;
    }
  }

  cleanup() {
    // Keep only last 30 days of stream history
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    this.analyticsData.streamHistory = this.analyticsData.streamHistory.filter(
      (stream) => stream.startTime > thirtyDaysAgo
    );

    // Clear old cache entries
    this.cache.clear();

    logger.debug('Analytics cleanup completed');
  }

  getStreamStats() {
    const stats = {
      uptime: Date.now() - this.currentStream.startTime,
      viewers: this.currentStream.viewers.length,
      chatMessages: this.currentStream.chatMessages,
      uniqueChatters: this.currentStream.metrics.uniqueChatters.size,
      engagementScore: this.currentStream.metrics.engagementScore,
      peakViewers: this.currentStream.metrics.peakViewers,
      raids: this.currentStream.raids.length,
    };

    this.cache.set('streamStats', stats);
    return stats;
  }

  endStream() {
    try {
      this.currentStream.endTime = Date.now();
      const stats = this.getStreamStats();

      this.analyticsData.streamHistory.push({
        ...this.currentStream,
        metrics: {
          ...this.currentStream.metrics,
          uniqueChatters: Array.from(this.currentStream.metrics.uniqueChatters),
          commandUsage: Object.fromEntries(this.currentStream.metrics.commandUsage),
          categoryDuration: Object.fromEntries(this.currentStream.metrics.categoryDuration),
        },
      });

      this.queueWrite();
      return stats;
    } catch (error) {
      logger.error('Failed to end stream analytics:', error);
      return null;
    }
  }
}

const analytics = new Analytics();
export const initializeAnalytics = () => analytics.initialize();
export const startStream = () => analytics.startStream();
export const endAnalytics = () => analytics.endStream();
export default analytics;
