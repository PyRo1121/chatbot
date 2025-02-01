<<<<<<< HEAD
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import logger from '../utils/logger.js';

class ViewerAnalytics {
  constructor() {
    this.dbPath = join(process.cwd(), 'src/bot/analytics.json');
    this.data = this.loadData();
    this.activeViewers = new Set();
    this.chatters = new Map(); // Track individual chatter stats
    this.hourlyStats = new Array(24).fill(0); // Hourly viewer counts
    this.lastUpdate = Date.now();
    this.UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  }

  loadData() {
    try {
      if (existsSync(this.dbPath)) {
        const data = readFileSync(this.dbPath, 'utf8');
        return JSON.parse(data);
      }
      // Initialize with default structure
      const defaultData = {
        totalStreams: 0,
        totalHours: 0,
        peakViewers: 0,
        averageViewers: 0,
        topChatters: [],
        popularCommands: {},
        viewerRetention: {
          new: 0,
          returning: 0,
          regular: 0,
        },
        streamHistory: [],
        hourlyStats: this.hourlyStats,
        lastUpdated: new Date().toISOString(),
      };
      this.saveData(defaultData);
      return defaultData;
    } catch (error) {
      logger.error('Error loading analytics data:', error);
      return this.getDefaultData();
    }
  }

  saveData(data = this.data) {
    try {
      writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error('Error saving analytics data:', error);
    }
  }

  // Track viewer activity
  trackViewer(username, type = 'chat') {
    const now = Date.now();
    this.activeViewers.add(username);

    if (!this.chatters.has(username)) {
      this.chatters.set(username, {
        firstSeen: now,
        lastSeen: now,
        messageCount: 0,
        commandsUsed: 0,
        timeWatched: 0,
      });
    }

    const viewer = this.chatters.get(username);
    viewer.lastSeen = now;

    if (type === 'chat') {
      viewer.messageCount++;
    } else if (type === 'command') {
      viewer.commandsUsed++;
    }

    this.updateHourlyStats();
  }

  // Update hourly statistics
  updateHourlyStats() {
    const now = Date.now();
    if (now - this.lastUpdate >= this.UPDATE_INTERVAL) {
      const hour = new Date().getHours();
      this.hourlyStats[hour] = this.activeViewers.size;
      this.lastUpdate = now;

      // Update peak viewers
      if (this.activeViewers.size > this.data.peakViewers) {
        this.data.peakViewers = this.activeViewers.size;
      }

      // Calculate average viewers
      const totalViewers = this.hourlyStats.reduce((sum, count) => sum + count, 0);
      this.data.averageViewers = Math.round(totalViewers / 24);

      this.saveData();
    }
  }

  // Track command usage
  trackCommand(command) {
    if (!this.data.popularCommands[command]) {
      this.data.popularCommands[command] = 0;
    }
    this.data.popularCommands[command]++;
    this.saveData();
  }

  // Start tracking a new stream session
  startStream() {
    this.data.totalStreams++;
    this.data.streamHistory.push({
      startTime: new Date().toISOString(),
      peakViewers: 0,
      uniqueViewers: 0,
      chatMessages: 0,
      commands: {},
    });
    this.saveData();
  }

  // End current stream and save stats
  endStream() {
    if (this.data.streamHistory.length > 0) {
      const currentStream = this.data.streamHistory[this.data.streamHistory.length - 1];
      currentStream.endTime = new Date().toISOString();
      currentStream.duration = new Date(currentStream.endTime) - new Date(currentStream.startTime);
      currentStream.peakViewers = this.data.peakViewers;
      currentStream.uniqueViewers = this.activeViewers.size;

      // Calculate viewer retention
      const returningViewers = Array.from(this.chatters.values()).filter(
        (v) => v.messageCount > 1
      ).length;
      const regularViewers = Array.from(this.chatters.values()).filter(
        (v) => v.messageCount > 10
      ).length;

      this.data.viewerRetention = {
        new: this.activeViewers.size - returningViewers,
        returning: returningViewers - regularViewers,
        regular: regularViewers,
      };

      this.data.totalHours += currentStream.duration / (1000 * 60 * 60);
      this.saveData();
    }
  }

  // Get viewer engagement stats
  getEngagementStats() {
    const now = Date.now();
    const activeLastHour = Array.from(this.chatters.values()).filter(
      (v) => now - v.lastSeen < 60 * 60 * 1000
    ).length;

    return {
      currentViewers: this.activeViewers.size,
      activeLastHour,
      topChatters: Array.from(this.chatters.entries())
        .sort((a, b) => b[1].messageCount - a[1].messageCount)
        .slice(0, 10)
        .map(([username, stats]) => ({
          username,
          messages: stats.messageCount,
          commands: stats.commandsUsed,
        })),
      popularCommands: Object.entries(this.data.popularCommands)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      retention: this.data.viewerRetention,
      peakViewers: this.data.peakViewers,
      averageViewers: this.data.averageViewers,
    };
  }

  // Get stream history stats
  getStreamHistory(limit = 10) {
    return this.data.streamHistory.slice(-limit).map((stream) => ({
      date: new Date(stream.startTime).toLocaleDateString(),
      duration: Math.round((stream.duration / (1000 * 60 * 60)) * 10) / 10,
      peakViewers: stream.peakViewers,
      uniqueViewers: stream.uniqueViewers,
    }));
  }

  // Get best streaming times based on viewer counts
  getBestStreamingTimes() {
    const sortedHours = this.hourlyStats
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return sortedHours.map(({ hour, count }) => ({
      time: `${hour}:00`,
      averageViewers: Math.round(count),
    }));
  }

  // Clear old data to prevent memory bloat
  cleanup() {
    // Keep only last 30 days of stream history
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    this.data.streamHistory = this.data.streamHistory.filter(
      (stream) => new Date(stream.startTime) > thirtyDaysAgo
    );

    // Clear inactive chatters (not seen in 30 days)
    for (const [username, stats] of this.chatters.entries()) {
      if (stats.lastSeen < thirtyDaysAgo.getTime()) {
        this.chatters.delete(username);
      }
    }

    this.saveData();
  }
}

const analytics = new ViewerAnalytics();
export default analytics;
=======
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import logger from '../utils/logger.js';

class ViewerAnalytics {
  constructor() {
    this.dbPath = join(process.cwd(), 'src/bot/analytics.json');
    this.data = this.loadData();
    this.activeViewers = new Set();
    this.chatters = new Map(); // Track individual chatter stats
    this.hourlyStats = new Array(24).fill(0); // Hourly viewer counts
    this.lastUpdate = Date.now();
    this.UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  }

  loadData() {
    try {
      if (existsSync(this.dbPath)) {
        const data = readFileSync(this.dbPath, 'utf8');
        return JSON.parse(data);
      }
      // Initialize with default structure
      const defaultData = {
        totalStreams: 0,
        totalHours: 0,
        peakViewers: 0,
        averageViewers: 0,
        topChatters: [],
        popularCommands: {},
        viewerRetention: {
          new: 0,
          returning: 0,
          regular: 0,
        },
        streamHistory: [],
        hourlyStats: this.hourlyStats,
        lastUpdated: new Date().toISOString(),
      };
      this.saveData(defaultData);
      return defaultData;
    } catch (error) {
      logger.error('Error loading analytics data:', error);
      return this.getDefaultData();
    }
  }

  saveData(data = this.data) {
    try {
      writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error('Error saving analytics data:', error);
    }
  }

  // Track viewer activity
  trackViewer(username, type = 'chat') {
    const now = Date.now();
    this.activeViewers.add(username);

    if (!this.chatters.has(username)) {
      this.chatters.set(username, {
        firstSeen: now,
        lastSeen: now,
        messageCount: 0,
        commandsUsed: 0,
        timeWatched: 0,
      });
    }

    const viewer = this.chatters.get(username);
    viewer.lastSeen = now;

    if (type === 'chat') {
      viewer.messageCount++;
    } else if (type === 'command') {
      viewer.commandsUsed++;
    }

    this.updateHourlyStats();
  }

  // Update hourly statistics
  updateHourlyStats() {
    const now = Date.now();
    if (now - this.lastUpdate >= this.UPDATE_INTERVAL) {
      const hour = new Date().getHours();
      this.hourlyStats[hour] = this.activeViewers.size;
      this.lastUpdate = now;

      // Update peak viewers
      if (this.activeViewers.size > this.data.peakViewers) {
        this.data.peakViewers = this.activeViewers.size;
      }

      // Calculate average viewers
      const totalViewers = this.hourlyStats.reduce((sum, count) => sum + count, 0);
      this.data.averageViewers = Math.round(totalViewers / 24);

      this.saveData();
    }
  }

  // Track command usage
  trackCommand(command) {
    if (!this.data.popularCommands[command]) {
      this.data.popularCommands[command] = 0;
    }
    this.data.popularCommands[command]++;
    this.saveData();
  }

  // Start tracking a new stream session
  startStream() {
    this.data.totalStreams++;
    this.data.streamHistory.push({
      startTime: new Date().toISOString(),
      peakViewers: 0,
      uniqueViewers: 0,
      chatMessages: 0,
      commands: {},
    });
    this.saveData();
  }

  // End current stream and save stats
  endStream() {
    if (this.data.streamHistory.length > 0) {
      const currentStream = this.data.streamHistory[this.data.streamHistory.length - 1];
      currentStream.endTime = new Date().toISOString();
      currentStream.duration = new Date(currentStream.endTime) - new Date(currentStream.startTime);
      currentStream.peakViewers = this.data.peakViewers;
      currentStream.uniqueViewers = this.activeViewers.size;

      // Calculate viewer retention
      const returningViewers = Array.from(this.chatters.values()).filter(
        (v) => v.messageCount > 1
      ).length;
      const regularViewers = Array.from(this.chatters.values()).filter(
        (v) => v.messageCount > 10
      ).length;

      this.data.viewerRetention = {
        new: this.activeViewers.size - returningViewers,
        returning: returningViewers - regularViewers,
        regular: regularViewers,
      };

      this.data.totalHours += currentStream.duration / (1000 * 60 * 60);
      this.saveData();
    }
  }

  // Get viewer engagement stats
  getEngagementStats() {
    const now = Date.now();
    const activeLastHour = Array.from(this.chatters.values()).filter(
      (v) => now - v.lastSeen < 60 * 60 * 1000
    ).length;

    return {
      currentViewers: this.activeViewers.size,
      activeLastHour,
      topChatters: Array.from(this.chatters.entries())
        .sort((a, b) => b[1].messageCount - a[1].messageCount)
        .slice(0, 10)
        .map(([username, stats]) => ({
          username,
          messages: stats.messageCount,
          commands: stats.commandsUsed,
        })),
      popularCommands: Object.entries(this.data.popularCommands)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      retention: this.data.viewerRetention,
      peakViewers: this.data.peakViewers,
      averageViewers: this.data.averageViewers,
    };
  }

  // Get stream history stats
  getStreamHistory(limit = 10) {
    return this.data.streamHistory.slice(-limit).map((stream) => ({
      date: new Date(stream.startTime).toLocaleDateString(),
      duration: Math.round((stream.duration / (1000 * 60 * 60)) * 10) / 10,
      peakViewers: stream.peakViewers,
      uniqueViewers: stream.uniqueViewers,
    }));
  }

  // Get best streaming times based on viewer counts
  getBestStreamingTimes() {
    const sortedHours = this.hourlyStats
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return sortedHours.map(({ hour, count }) => ({
      time: `${hour}:00`,
      averageViewers: Math.round(count),
    }));
  }

  // Clear old data to prevent memory bloat
  cleanup() {
    // Keep only last 30 days of stream history
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    this.data.streamHistory = this.data.streamHistory.filter(
      (stream) => new Date(stream.startTime) > thirtyDaysAgo
    );

    // Clear inactive chatters (not seen in 30 days)
    for (const [username, stats] of this.chatters.entries()) {
      if (stats.lastSeen < thirtyDaysAgo.getTime()) {
        this.chatters.delete(username);
      }
    }

    this.saveData();
  }
}

const analytics = new ViewerAnalytics();
export default analytics;
>>>>>>> origin/master
