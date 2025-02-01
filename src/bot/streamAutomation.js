import logger from '../utils/logger.js';
import { generateResponse } from '../utils/perplexity.js';
import streamManager from './streamManager.js';

class StreamAutomation {
  constructor() {
    this.client = null;
    this.automationState = {
      isLive: false,
      startTime: null,
      lastUpdate: null,
      scheduledMessages: [],
      activeTimers: new Map(),
      customActions: new Map(),
    };
  }

  async init(twitchClient) {
    try {
      if (!twitchClient) {
        throw new Error(
          'TwitchClient is required for StreamAutomation initialization'
        );
      }
      if (!twitchClient.apiClient) {
        throw new Error('TwitchClient API client is not initialized');
      }

      logger.debug('Initializing stream automation with client:', {
        hasClient: !!twitchClient,
        hasApiClient: !!twitchClient.apiClient,
        hasChat: !!twitchClient.client,
      });

      this.client = twitchClient;
      this.setupAutomation();
      logger.info('Stream automation initialized');
    } catch (error) {
      logger.error('Error initializing stream automation:', error);
      throw error;
    }
  }

  setupAutomation() {
    logger.info('Setting up stream automation timers and actions...');
    this.automationState.activeTimers.set(
      'streamCheck',
      setInterval(() => this.checkStreamStatus(), 5 * 60 * 1000)
    );
    this.automationState.activeTimers.set(
      'messageRotation',
      setInterval(() => this.rotateScheduledMessages(), 15 * 60 * 1000)
    );
    this.setupCustomActions();
    logger.info('Stream automation setup completed');
  }

  setupCustomActions() {
    this.automationState.customActions.set('milestone', async (data) => {
      const prompt = `Create an exciting milestone announcement for: ${data.description}
Make it engaging and celebratory. Keep it under 200 characters.`;
      const message = await generateResponse(prompt);
      return message || `We just hit a milestone: ${data.description}! 🎉`;
    });

    this.automationState.customActions.set('raidWelcome', async (data) => {
      const prompt = `Create a warm welcome message for a raid from ${data.raider} with ${data.viewers} viewers.
Make it enthusiastic and welcoming. Keep it under 200 characters.`;
      const message = await generateResponse(prompt);
      return message || `Welcome raiders from ${data.raider}'s channel! 🎉`;
    });

    this.automationState.customActions.set('streamStart', async (data) => {
      const prompt = `Create a stream start announcement with category: ${data.category} and title: ${data.title}
Make it exciting and inviting. Keep it under 200 characters.`;
      const message = await generateResponse(prompt);
      return (
        message || `Stream is starting! Playing ${data.category}: ${data.title}`
      );
    });
  }

  async checkStreamStatus() {
    if (!this.client) {
      logger.error('TwitchClient not initialized in StreamAutomation');
      return;
    }

    try {
      const channel = await this.client.apiClient.channels.getChannelInfoById(
        this.client.channelId
      );
      const stream = await this.client.apiClient.streams.getStreamByUserId(
        this.client.channelId
      );

      logger.debug('Stream status check:', {
        channelExists: !!channel,
        streamExists: !!stream,
        currentlyLive: this.automationState.isLive,
      });

      if (stream && !this.automationState.isLive) {
        await this.handleStreamStart(stream);
      } else if (!stream && this.automationState.isLive) {
        await this.handleStreamEnd();
      }

      if (stream) {
        streamManager.updateViewers(stream.viewers);
        this.automationState.lastUpdate = Date.now();
      }
    } catch (error) {
      logger.error('Error checking stream status:', error);
    }
  }

  async handleStreamStart(stream) {
    try {
      this.automationState.isLive = true;
      this.automationState.startTime = Date.now();
      streamManager.startStream();
      const message = await this.automationState.customActions.get(
        'streamStart'
      )({
        category: stream.gameName,
        title: stream.title,
      });
      await this.client.client.say(process.env.TWITCH_CHANNEL, message);
      logger.info('Stream start handled');
    } catch (error) {
      logger.error('Error handling stream start:', error);
    }
  }

  async handleStreamEnd() {
    try {
      this.automationState.isLive = false;
      const endMessage = await streamManager.generateStreamEndMessage();
      await this.client.client.say(process.env.TWITCH_CHANNEL, endMessage);
      streamManager.endStream();
      logger.info('Stream end handled');
    } catch (error) {
      logger.error('Error handling stream end:', error);
    }
  }

  async rotateScheduledMessages() {
    if (
      !this.automationState.isLive ||
      this.automationState.scheduledMessages.length === 0
    ) {
      return;
    }
    try {
      const message = this.automationState.scheduledMessages.shift();
      this.automationState.scheduledMessages.push(message);
      await this.client.client.say(process.env.TWITCH_CHANNEL, message);
    } catch (error) {
      logger.error('Error rotating scheduled messages:', error);
    }
  }

  addScheduledMessage(message) {
    this.automationState.scheduledMessages.push(message);
    return this.automationState.scheduledMessages.length;
  }

  removeScheduledMessage(index) {
    if (index >= 0 && index < this.automationState.scheduledMessages.length) {
      this.automationState.scheduledMessages.splice(index, 1);
      return true;
    }
    return false;
  }

  async handleMilestone(description) {
    try {
      const message = await this.automationState.customActions.get('milestone')(
        { description }
      );
      await this.client.client.say(process.env.TWITCH_CHANNEL, message);
      streamManager.addHighlight({ type: 'milestone', description });
    } catch (error) {
      logger.error('Error handling milestone:', error);
    }
  }

  async handleRaid(raider, viewers) {
    try {
      const message = await this.automationState.customActions.get(
        'raidWelcome'
      )({
        raider,
        viewers,
      });
      await this.client.client.say(process.env.TWITCH_CHANNEL, message);
      streamManager.trackRaid({ username: raider, viewers });
    } catch (error) {
      logger.error('Error handling raid:', error);
    }
  }

  cleanup() {
    logger.info('Starting stream automation cleanup...');
    for (const [name, timer] of this.automationState.activeTimers) {
      clearInterval(timer);
      this.automationState.activeTimers.delete(name);
    }
    this.automationState = {
      isLive: false,
      startTime: null,
      lastUpdate: null,
      scheduledMessages: [],
      activeTimers: new Map(),
      customActions: new Map(),
    };
    this.client = null;
    logger.info('Stream automation cleaned up');
  }
}

export default new StreamAutomation();
