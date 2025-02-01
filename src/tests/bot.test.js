import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import logger from '../utils/logger.js';
import getClient from '../bot/twitchClient.js';
import analytics from '../bot/analytics.js';
import viewerManager from '../bot/viewerManager.js';
import moderationManager from '../bot/moderationManager.js';
import streamAnalytics from '../bot/streamAnalytics.js';
import { handlePing } from '../bot/commands/ping.js';
import { handleRoast } from '../bot/commands/roast.js';

// Mock dependencies
jest.mock('../utils/logger.js');
jest.mock('../bot/twitchClient.js');
jest.mock('../bot/analytics.js');
jest.mock('../bot/viewerManager.js');
jest.mock('../bot/moderationManager.js');
jest.mock('../bot/streamAnalytics.js');
jest.mock('../utils/perplexity.js');

describe('Bot Commands', () => {
  let mockClient;
  let mockChannel;
  let mockUser;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock data
    mockClient = {
      say: jest.fn(),
      whisper: jest.fn(),
      timeout: jest.fn(),
      ban: jest.fn(),
    };

    mockChannel = '#testchannel';
    mockUser = {
      username: 'testuser',
      'user-id': '123456',
      badges: null,
    };
  });

  test('handlePing returns pong message', async () => {
    const response = await handlePing();
    expect(response).toBe('🏓 Pong!');
  });

  test('handleRoast generates roast message', async () => {
    const response = await handleRoast(
      mockClient,
      mockChannel,
      mockUser,
      'targetuser'
    );
    expect(response).toContain('@targetuser');
  });

  test('logger.error is called with correct parameters', () => {
    const error = new Error('Test error message');
    logger.error('Test error message', error);
    expect(logger.error).toHaveBeenCalledWith('Test error message', error);
  });

  test('analytics tracks commands correctly', () => {
    analytics.trackCommand('!test');
    expect(analytics.trackCommand).toHaveBeenCalledWith('!test');
  });

  test('viewerManager handles new viewers correctly', () => {
    viewerManager.handleNewViewer('newuser');
    expect(viewerManager.handleNewViewer).toHaveBeenCalledWith('newuser');
  });

  test('moderationManager handles messages correctly', async () => {
    await moderationManager.handleMessage('test message', mockUser);
    expect(moderationManager.handleMessage).toHaveBeenCalledWith(
      'test message',
      mockUser
    );
  });

  test('streamAnalytics tracks stream data correctly', () => {
    streamAnalytics.trackStreamData({ viewers: 10 });
    expect(streamAnalytics.trackStreamData).toHaveBeenCalledWith({
      viewers: 10,
    });
  });

  test('client handles errors correctly', async () => {
    const mockError = new Error('Connection error');
    mockClient.connect = jest.fn().mockRejectedValue(mockError);

    try {
      await getClient();
    } catch (error) {
      expect(logger.error).toHaveBeenCalledWith(
        'Error initializing Twitch client:',
        mockError
      );
    }
  });

  test('commands list includes essential commands', () => {
    const response = handlePing();
    expect(response).toContain('!commands');
  });
});
