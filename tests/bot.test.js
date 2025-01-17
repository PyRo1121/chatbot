const { describe, test, expect, beforeEach } = require('@jest/globals');
const tmi = require('tmi.js');
const bot = require('../bot.js');
const responseHandler = require('../responseHandler.js');

jest.mock('tmi.js');
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'mocked response' } }]
        })
      }
    },
    moderations: {
      create: jest.fn().mockResolvedValue({
        results: [{ flagged: false, categories: {} }]
      })
    }
  }));
});
jest.mock('../spotify.js', () => ({}));
jest.mock('../overlays.js', () => ({
  renderTemplate: jest.fn(),
  broadcastUpdate: jest.fn()
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
      say: jest.fn()
    };
    tmi.Client.mockImplementation(() => mockClient);
  });

  test('should initialize bot with correct configuration', () => {
    const botInstance = bot();
    expect(tmi.Client).toHaveBeenCalledWith({
      options: { debug: true },
      identity: {
        username: process.env.BOT_USERNAME,
        password: process.env.OAUTH_TOKEN
      },
      channels: [process.env.CHANNEL_NAME]
    });
  });

  test('should connect to Twitch', () => {
    const botInstance = bot();
    expect(mockClient.connect).toHaveBeenCalled();
  });
});

describe('Command Handling', () => {
  let mockClient;

  beforeEach(() => {
    mockClient = {
      say: jest.fn()
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
    const response = mockClient.say.mock.calls[0][1];
    expect(response).toContain('!nowplaying');
    expect(response).toContain('!request');
    expect(response).toContain('!queue');
    expect(response).toContain('!commands');
  });
});
