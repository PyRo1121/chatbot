import { LRUCache } from 'lru-cache';
import { writeFile, readFile, rename, mkdir } from 'fs/promises';
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
    this.dataPath = '/Users/olen/Documents/bot/chatbot/src/bot/analytics.json';
    this.backupPath = '/Users/olen/Documents/bot/chatbot/src/bot/backups';

    // Initialize system
    this.initialize();

    // Setup auto-save and processing
    this.setupIntervals();

    // Add auto-save interval (every 15 minutes)
    this.AUTO_SAVE_INTERVAL = 1000 * 60 * 15; // Change to 15 minutes
    this.MIN_SAVE_INTERVAL = 1000 * 60 * 5; // Minimum 5 minutes between saves
    this.lastAutoSave = Date.now();
    this.saveTimeout = null;

    // Add backup rotation
    this.MAX_BACKUPS = 3;

    // Memory optimization
    this.PRUNE_THRESHOLD = 1000;
  }

  setupIntervals() {
    setInterval(() => this.processWrites(), this.PROCESSING_INTERVAL);
    setInterval(() => this.processBatch(), this.PROCESSING_INTERVAL);
    setInterval(() => this.cleanup(), 1000 * 60 * 60); // Hourly cleanup
    setInterval(() => this.pruneMemory(), 1000 * 60 * 15); // Every 15 minutes

    // Set up dedicated auto-save interval
    setInterval(() => this.debouncedAutoSave(), this.AUTO_SAVE_INTERVAL);
  }

  debouncedAutoSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    const timeSinceLastSave = Date.now() - this.lastAutoSave;
    if (timeSinceLastSave < this.MIN_SAVE_INTERVAL) {
      return;
    }

    this.saveTimeout = setTimeout(() => {
      if (this.currentStream.startTime) {
        this.processWrites();
        this.lastAutoSave = Date.now();
      }
    }, 1000); // 1 second debounce
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
      logger.warn('No existing analytics data found, creating new:', error);
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
    if (this.writing) {
      return;
    }

    const timeSinceLastSave = Date.now() - this.lastWrite;
    if (timeSinceLastSave < this.MIN_SAVE_INTERVAL) {
      return;
    }

    this.writing = true;
    try {
      // Validate data before saving
      this.validateData();

      // Ensure backup directory exists
      await mkdir(this.backupPath, { recursive: true });

      // Rotate backups with correct path joining
      const renamePromises = [];
      for (let i = this.MAX_BACKUPS - 1; i > 0; i--) {
        const oldPath = join(this.backupPath, `analytics.${i}.json`);
        const newPath = join(this.backupPath, `analytics.${i + 1}.json`);
        renamePromises.push(
          rename(oldPath, newPath).catch(() => {
            // Ignore if backup doesn't exist
          })
        );
      }
      await Promise.all(renamePromises);

      // Create new backup with proper path
      const latestBackup = join(this.backupPath, 'analytics.1.json');
      await writeFile(latestBackup, JSON.stringify(this.analyticsData, null, 2));

      // Save main file
      await writeFile(this.dataPath, JSON.stringify(this.analyticsData, null, 2));

      this.writeQueue = [];
      this.lastWrite = Date.now();
      // Only log on successful writes
      logger.debug('Analytics data saved'); // Changed to debug level
    } catch (error) {
      logger.error('Failed to write analytics data:', error);
      // Attempt recovery from backup
      await this.recoverFromBackup();
    } finally {
      this.writing = false;
    }
  }

  validateData() {
    // Basic data structure validation
    if (!this.analyticsData.streamHistory || typeof this.analyticsData.streamHistory !== 'object') {
      this.analyticsData.streamHistory = {};
    }
    if (!this.analyticsData.totalStreams) {
      this.analyticsData.totalStreams = 0;
    }
    if (!this.analyticsData.totalHours) {
      this.analyticsData.totalHours = 0;
    }
    if (!this.analyticsData.popularCommands) {
      this.analyticsData.popularCommands = {};
    }

    // Validate current stream data
    if (this.currentStream.chatMessages < 0) {
      this.currentStream.chatMessages = 0;
    }
    if (this.currentStream.metrics.peakViewers < 0) {
      this.currentStream.metrics.peakViewers = 0;
    }
  }

  async recoverFromBackup() {
    const backupPromises = Array.from({ length: this.MAX_BACKUPS }, (_, i) => {
      const backupPath = join(this.backupPath, `analytics.${i + 1}.json`);
      return readFile(backupPath, 'utf8')
        .then((data) => ({ success: true, data, index: i + 1 }))
        .catch(() => ({ success: false, index: i + 1 }));
    });

    const results = await Promise.all(backupPromises);
    const firstValidBackup = results.find((result) => result.success);

    if (firstValidBackup) {
      this.analyticsData = JSON.parse(firstValidBackup.data);
      logger.info(`Recovered from backup ${firstValidBackup.index}`);
    } else {
      logger.error('All backup recovery attempts failed');
    }
  }

  autoSave() {
    if (this.currentStream.startTime) {
      this.debouncedAutoSave();
    }
  }

  pruneMemory() {
    if (this.currentStream.chatMessages > this.PRUNE_THRESHOLD) {
      // Keep only last 1000 messages worth of data
      const oldestAllowed = Date.now() - 1000 * 60 * 60; // 1 hour
      this.currentStream.highlights = this.currentStream.highlights
        .filter((h) => h.timestamp > oldestAllowed)
        .slice(-100);

      // Clear old cached data
      this.cache.clear();

      logger.info('Memory pruned successfully');
    }
  }

  cleanup() {
    try {
      // Keep only last 30 days of stream history
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

      // Handle streamHistory as an object with date keys
      if (this.analyticsData.streamHistory) {
        const filteredHistory = {};
        Object.entries(this.analyticsData.streamHistory).forEach(([date, data]) => {
          // Convert date string to timestamp for comparison
          const streamDate = new Date(date).getTime();
          if (streamDate > thirtyDaysAgo) {
            filteredHistory[date] = data;
          }
        });
        this.analyticsData.streamHistory = filteredHistory;
      }

      // Clear old cache entries
      this.cache.clear();

      logger.debug('Analytics cleanup completed');
    } catch (error) {
      logger.error('Error during analytics cleanup:', error);
    }
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

  async endStream() {
    try {
      this.currentStream.endTime = Date.now();
      const stats = this.getStreamStats();

      // Format today's date as YYYY-MM-DD
      const [today] = new Date().toISOString().split('T');

      // Calculate stream duration in seconds
      const duration = (this.currentStream.endTime - this.currentStream.startTime) / 1000;

      // Format stream data for storage
      const streamData = {
        duration,
        peakViewers: this.currentStream.metrics.peakViewers,
        chatMessages: this.currentStream.chatMessages,
        commands: Object.fromEntries(this.currentStream.commands),
        highlights: this.currentStream.highlights,
        raids: this.currentStream.raids,
      };

      // Update stream history in analytics data
      if (!this.analyticsData.streamHistory) {
        this.analyticsData.streamHistory = {};
      }

      this.analyticsData.streamHistory[today] = streamData;

      // Update overall stats
      if (!this.analyticsData.totalStreams) {
        this.analyticsData.totalStreams = 0;
      }
      if (!this.analyticsData.totalHours) {
        this.analyticsData.totalHours = 0;
      }
      if (!this.analyticsData.popularCommands) {
        this.analyticsData.popularCommands = {};
      }

      this.analyticsData.totalStreams++;
      this.analyticsData.totalHours += duration / 3600;

      // Update popular commands
      for (const [command, count] of this.currentStream.commands) {
        this.analyticsData.popularCommands[command] =
          (this.analyticsData.popularCommands[command] || 0) + count;
      }

      await this.processWrites();
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
