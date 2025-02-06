import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import logger from '../utils/logger.js';
import { generateResponse } from '../utils/deepseek.js';
import { ApiClient } from '@twurple/api';
import { RefreshingAuthProvider } from '@twurple/auth';
import tokenManager from '../auth/tokenManager.js';

class ChannelPointsHandler {
  constructor() {
    this.dbPath = join(process.cwd(), 'src/bot/channel_points.json');
    this.redemptions = this.loadRedemptions();
  }

  loadRedemptions() {
    try {
      if (existsSync(this.dbPath)) {
        const data = readFileSync(this.dbPath, 'utf8');
        return JSON.parse(data);
      }
      // Initialize with default redemptions
      const defaultRedemptions = {
        'Highlight My Message': {
          enabled: true,
          cost: 500,
          userCooldown: 300, // 5 minutes
          handler: 'highlightMessage',
        },
        'Create Stream Marker': {
          enabled: true,
          cost: 1000,
          userCooldown: 60, // 1 minute
          handler: 'createMarker',
        },
        'Create Clip': {
          enabled: true,
          cost: 1500,
          userCooldown: 120, // 2 minutes
          handler: 'createClip',
        },
        'Custom AI Response': {
          enabled: true,
          cost: 2000,
          userCooldown: 300, // 5 minutes
          handler: 'generateAIResponse',
        },
      };
      this.saveRedemptions(defaultRedemptions);
      return defaultRedemptions;
    } catch (error) {
      logger.error('Error loading channel points redemptions:', error);
      return {};
    }
  }

  saveRedemptions(redemptions = this.redemptions) {
    try {
      writeFileSync(this.dbPath, JSON.stringify(redemptions, null, 2));
    } catch (error) {
      logger.error('Error saving channel points redemptions:', error);
    }
  }

  async handleRedemption(redemptionName, username, input) {
    const redemption = this.redemptions[redemptionName];
    if (!redemption || !redemption.enabled) {
      return {
        success: false,
        message: 'This redemption is not available.',
      };
    }

    try {
      switch (redemption.handler) {
        case 'highlightMessage':
          return this.handleHighlightMessage(input, username);
        case 'createMarker':
          return await this.handleCreateMarker(input, username);
        case 'createClip':
          return await this.handleCreateClip(input, username);
        case 'generateAIResponse':
          return await this.handleAIResponse(input, username);
        default:
          return {
            success: false,
            message: 'Unknown redemption type.',
          };
      }
    } catch (error) {
      logger.error('Error handling redemption:', error);
      return {
        success: false,
        message: 'An error occurred while processing your redemption.',
      };
    }
  }

  handleHighlightMessage(message, username) {
    return {
      success: true,
      message: `🌟 Highlighted message from ${username}: ${message}`,
      highlight: true,
    };
  }

  async getApiClient() {
    const { broadcasterAuthProvider } = await tokenManager.getAuthProviders();
    return new ApiClient({ authProvider: broadcasterAuthProvider });
  }

  async handleCreateMarker(description, username) {
    try {
      const api = await this.getApiClient();
      const marker = await api.streams.createStreamMarker({
        description: description || `Marker created by ${username}`,
      });

      return {
        success: true,
        message: `📍 Stream marker created by ${username}${description ? `: ${description}` : ''}`,
        markerId: marker.id,
      };
    } catch (error) {
      logger.error('Error creating stream marker:', error);
      return {
        success: false,
        message: 'Failed to create stream marker. Make sure the stream is live.',
      };
    }
  }

  async handleCreateClip(title, username) {
    try {
      const api = await this.getApiClient();
      const clip = await api.clips.createClip({
        channel: process.env.TWITCH_CHANNEL,
      });

      // Wait for clip to be processed
      await new Promise((resolve) => setTimeout(resolve, 5000));

      return {
        success: true,
        message: `✂️ Clip created by ${username}: ${clip.edit_url}`,
        clipId: clip.id,
        clipUrl: clip.edit_url,
      };
    } catch (error) {
      logger.error('Error creating clip:', error);
      return {
        success: false,
        message: 'Failed to create clip. Make sure the stream is live.',
      };
    }
  }

  async handleAIResponse(prompt, username) {
    try {
      const response = await generateResponse(
        prompt,
        'You are a fun and entertaining Twitch bot. Keep responses concise, engaging, and stream-appropriate.'
      );

      return {
        success: true,
        message: `🤖 AI Response for ${username}: ${response}`,
      };
    } catch (error) {
      logger.error('Error generating AI response:', error);
      return {
        success: false,
        message: 'Failed to generate AI response.',
      };
    }
  }

  addRedemption(name, options) {
    if (this.redemptions[name]) {
      return false;
    }

    this.redemptions[name] = {
      enabled: true,
      cost: options.cost || 1000,
      userCooldown: options.cooldown || 300,
      handler: options.handler || 'custom',
      ...options,
    };

    this.saveRedemptions();
    return true;
  }

  removeRedemption(name) {
    if (!this.redemptions[name]) {
      return false;
    }

    delete this.redemptions[name];
    this.saveRedemptions();
    return true;
  }

  updateRedemption(name, options) {
    if (!this.redemptions[name]) {
      return false;
    }

    this.redemptions[name] = {
      ...this.redemptions[name],
      ...options,
    };

    this.saveRedemptions();
    return true;
  }

  listRedemptions() {
    return Object.entries(this.redemptions).map(([name, data]) => ({
      name,
      cost: data.cost,
      enabled: data.enabled,
      cooldown: data.userCooldown,
    }));
  }
}

const channelPoints = new ChannelPointsHandler();
export default channelPoints;
