import getClient from './twitchClient.js';
import logger from '../utils/logger.js';
import viewerManager from './viewerManager.js';

class StreamAutomation {
  constructor() {
    this.logger = logger;
    this.viewerManager = viewerManager;
    this.queue = {
      games: [],
      activities: [],
      current: null,
    };
    this.shoutoutHistory = new Map();
  }

  async init() {
    this.client = await getClient();
  }

  async handleNewFollower(user) {
    try {
      const viewerData = await this.viewerManager.getViewerData(user);
      const message = this.generateShoutoutMessage(viewerData);
      this.client.sendMessage(message);
      this.shoutoutHistory.set(user, Date.now());
    } catch (error) {
      this.logger.error('Error handling new follower:', error);
    }
  }

  generateShoutoutMessage(viewerData) {
    const lastSeen = this.shoutoutHistory.get(viewerData.username);
    const isNew = !lastSeen || Date.now() - lastSeen > 86400000; // 24 hours

    const messages = [
      `Welcome ${viewerData.username} to the stream!`,
      `Thanks for following ${viewerData.username}!`,
      `Big shoutout to ${viewerData.username} for following!`,
    ];

    return isNew ? messages[Math.floor(Math.random() * messages.length)] : '';
  }

  addToQueue(type, item) {
    if (type === 'game') {
      this.queue.games.push(item);
    } else if (type === 'activity') {
      this.queue.activities.push(item);
    }
    this.updateQueueDisplay();
  }

  nextInQueue() {
    if (this.queue.games.length > 0) {
      this.queue.current = this.queue.games.shift();
    } else if (this.queue.activities.length > 0) {
      this.queue.current = this.queue.activities.shift();
    }
    this.updateQueueDisplay();
    return this.queue.current;
  }

  updateQueueDisplay() {
    const queueData = {
      games: this.queue.games,
      activities: this.queue.activities,
      current: this.queue.current,
    };
    this.client.updateOverlay('queue', queueData);
  }
}

export default StreamAutomation;
