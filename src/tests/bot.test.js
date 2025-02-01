<<<<<<< HEAD
import { describe, test, expect, beforeEach } from '@jest/globals';
import tmi from 'tmi.js';
import { client as bot } from '../bot/bot.js';
import * as responseHandler from '../events/responseHandler.js';

jest.mock('tmi.js');
jest.mock('openai', () =>
  jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'mocked response' } }],
        }),
      },
    },
    moderations: {
      create: jest.fn().mockResolvedValue({
        results: [{ flagged: false, categories: {} }],
      }),
    },
  }))
);
jest.mock('../spotify/spotify.js', () => ({}));
jest.mock('../overlays/overlays.js', () => ({
  renderTemplate: jest.fn(),
  broadcastUpdate: jest.fn(),
}));

// Mock environment variables
process.env.OPENAI_API_KEY = 'test-key';
process.env.TWITCH_BOT_USERNAME = 'test-bot';
process.env.TWITCH_OAUTH_TOKEN = 'test-token';
process.env.TWITCH_CHANNEL = 'test-channel';
process.env.BOT_USERNAME = 'test-bot';
process.env.OAUTH_TOKEN = 'test-token';
process.env.CHANNEL_NAME = 'test-channel';

describe('Bot Functionality', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = {
      connect: jest.fn(),
      on: jest.fn(),
      say: jest.fn(),
    };
    tmi.Client.mockImplementation(() => mockClient);
  });

  test('should initialize bot with correct configuration', () => {
    const botInstance = bot();
    expect(botInstance).toBeDefined();
    expect(tmi.Client).toHaveBeenCalledWith({
      options: { debug: true },
      identity: {
        username: process.env.BOT_USERNAME,
        password: process.env.OAUTH_TOKEN,
      },
      channels: [process.env.CHANNEL_NAME],
    });
  });

  test('should connect to Twitch', () => {
    const botInstance = bot();
    expect(botInstance).toBeDefined();
    expect(mockClient.connect).toHaveBeenCalled();
  });
});

describe('Command Handling', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = {
      say: jest.fn(),
    };
  });

  test('should handle !commands with basic format', async () => {
    await responseHandler.handleMessage('#test', {}, '!commands');
    expect(mockClient.say).toHaveBeenCalledWith(
      '#test',
      expect.stringContaining('Available commands:')
    );
  });

  test('should handle !commands with extra spaces', async () => {
    await responseHandler.handleMessage('#test', {}, '   !commands   ');
    expect(mockClient.say).toHaveBeenCalledWith(
      '#test',
      expect.stringContaining('Available commands:')
    );
  });

  test('should handle !commands in different cases', async () => {
    await responseHandler.handleMessage('#test', {}, '!COMMANDS');
    expect(mockClient.say).toHaveBeenCalledWith(
      '#test',
      expect.stringContaining('Available commands:')
    );
  });

  test('should handle !commands with special characters', async () => {
    await responseHandler.handleMessage('#test', {}, '!commands\u200B');
    expect(mockClient.say).toHaveBeenCalledWith(
      '#test',
      expect.stringContaining('Available commands:')
    );
  });

  test('should include all commands in response', async () => {
    await responseHandler.handleMessage('#test', {}, '!commands');
    const [[, response]] = mockClient.say.mock.calls;
    expect(response).toContain('!nowplaying');
    expect(response).toContain('!request');
    expect(response).toContain('!queue');
    expect(response).toContain('!commands');
=======
import logger from '../utils/logger.js';

jest.mock('tmi.js');
jest.mock('@ai-sdk/perplexity', () => ({
  perplexity: jest.fn().mockReturnValue('mocked-model'),
}));

jest.mock('ai', () => ({
  generateText: jest.fn().mockImplementation(({ messages }) => {
    // Return different responses based on the type of request
    if (messages[0].content.includes('content moderator')) {
      return Promise.resolve({
        text: JSON.stringify({
          toxicityScore: 0.5,
          flagged: false,
          categories: {},
        }),
      });
    }
    return Promise.resolve({
      text: 'Mocked response',
    });
  }),
}));

jest.mock('../utils/logger.js', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('Bot functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should log errors properly', () => {
    const error = new Error('Test error');
    logger.error('Test error message', error);
    expect(logger.error).toHaveBeenCalledWith('Test error message', error);
>>>>>>> origin/master
  });
});
