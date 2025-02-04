import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import winston from 'winston';
import events from 'events';
const { EventEmitter } = events;

// Import mocks from setup
import { mocks } from '../../jest.setup.js';

// Mock external modules
jest.unstable_mockModule('../bot/commands/index.js', () => ({
  handlePing: jest.fn(() => '🏓 Pong!'),
  handleLurk: jest.fn(() => 'Lurk message'),
  handleRoast: jest.fn((client, channel, user, target) => `@${target} roasted!`),
  handleTitle: jest.fn(),
  handleCategory: jest.fn(),
  handleUptime: jest.fn(() => 'Stream uptime'),
  handleFollowMode: jest.fn(() => 'Follow mode response'),
}));

jest.unstable_mockModule('../bot/commands/games.js', () => ({
  handleTrivia: jest.fn(() => 'Trivia started'),
  handleQueue: jest.fn((client, channel, user, args) => {
    if (!args || args.length === 0) {
      return 'Usage: !queue <action>';
    }
    switch (args[0]) {
      case 'add':
        return 'Added to queue';
      case 'remove':
        return 'Removed from queue';
      case 'view':
        return 'Current queue';
      default:
        return 'Usage: !queue <action>';
    }
  }),
}));

jest.unstable_mockModule('../bot/commands/moderation.js', () => ({
  handleTimeout: jest.fn((client, channel, user, args) => {
    if (!user.isMod) {
      return 'only moderators';
    }
    if (args.length < 2 || isNaN(args[1])) {
      return 'Invalid timeout duration';
    }
    return `${args[0]} has been timed out`;
  }),
  handleBan: jest.fn((client, channel, user, args) => {
    if (!user.isMod) {
      return 'only moderators';
    }
    return `${args[0]} has been banned`;
  }),
  handleUnban: jest.fn((client, channel, user, args) => {
    if (!user.isMod) {
      return 'only moderators';
    }
    return `${args[0]} has been unbanned`;
  }),
}));

jest.unstable_mockModule('../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    startupMessage: jest.fn(),
    sectionHeader: jest.fn(),
    debugObject: jest.fn(),
    levels: winston.config.npm.levels,
    level: 'info',
  },
}));

jest.unstable_mockModule('../utils/gemini.js', () => ({
  default: {
    generateResponse: jest.fn(async (prompt, context) => {
      if (!prompt) {
        throw new Error('Prompt cannot be empty');
      }
      if (prompt.length > 5000) {
        throw new Error('Prompt is too long');
      }
      return 'Generated response';
    }),
  },
}));

// Import mocked modules
const commands = await import('../bot/commands/index.js');
const gamesCommands = await import('../bot/commands/games.js');
const moderationCommands = await import('../bot/commands/moderation.js');
const logger = (await import('../utils/logger.js')).default;
const perplexity = (await import('../utils/gemini.js')).default;

// Shared mock objects
const mockClient = {
  say: jest.fn(),
  whisper: jest.fn(),
  timeout: jest.fn(),
  ban: jest.fn(),
  client: {
    say: jest.fn(),
  },
  apiClient: {
    users: {
      getUserByName: jest.fn().mockResolvedValue({ id: '123', name: 'testuser' }),
    },
    channels: {
      updateChannelInfo: jest.fn().mockResolvedValue(true),
    },
    clips: {
      createClip: jest.fn().mockResolvedValue({ id: 'clip123' }),
    },
  },
};

const mockChannel = '#testchannel';
const mockUser = {
  username: 'testuser',
  'user-id': '123456',
  badges: null,
  isMod: false,
  isBroadcaster: false,
};

const mockBroadcasterUser = {
  ...mockUser,
  isBroadcaster: true,
};

const mockModUser = {
  ...mockUser,
  isMod: true,
};

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Bot Commands Tests
describe('Bot Commands', () => {
  // Basic Commands
  describe('Basic Commands', () => {
    test('!ping returns pong message', async () => {
      const response = await commands.handlePing();
      expect(response).toBe('🏓 Pong!');
    });

    test('!lurk generates lurk message', async () => {
      const response = await commands.handleLurk(mockClient, mockChannel, mockUser);
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    });

    test('!roast generates roast message', async () => {
      const response = await commands.handleRoast(mockClient, mockChannel, mockUser, 'targetuser');
      expect(response).toContain('@targetuser');
    });
  });

  // Stream Management Commands
  describe('Stream Management Commands', () => {
    test('!title changes stream title (mod only)', async () => {
      const newTitle = 'New Stream Title';
      await commands.handleTitle(mockClient, mockChannel, mockModUser, newTitle);
      expect(mockClient.client.say).toHaveBeenCalledWith(
        mockChannel,
        expect.stringContaining(newTitle)
      );
    });

    test('!category changes stream category (mod only)', async () => {
      const newCategory = 'Just Chatting';
      await commands.handleCategory(mockClient, mockChannel, mockModUser, newCategory);
      expect(mockClient.client.say).toHaveBeenCalledWith(
        mockChannel,
        expect.stringContaining(newCategory)
      );
    });

    test('!uptime shows stream uptime', async () => {
      const response = await commands.handleUptime(mockClient, mockChannel, mockUser);
      expect(response).toBeDefined();
    });
  });

  // Games Commands
  describe('Games Commands', () => {
    test('trivia command initializes game', async () => {
      const response = await gamesCommands.handleTrivia(mockClient, mockChannel, mockUser);
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.toLowerCase()).toContain('trivia');
    });

    test('queue command manages user queue', async () => {
      // Test adding to queue
      const addResponse = await gamesCommands.handleQueue(mockClient, mockChannel, mockUser, [
        'add',
      ]);
      expect(addResponse).toBeDefined();
      expect(typeof addResponse).toBe('string');
      expect(addResponse.toLowerCase()).toContain('added');

      // Test removing from queue
      const removeResponse = await gamesCommands.handleQueue(mockClient, mockChannel, mockUser, [
        'remove',
      ]);
      expect(removeResponse).toBeDefined();
      expect(typeof removeResponse).toBe('string');
      expect(removeResponse.toLowerCase()).toContain('removed');

      // Test viewing queue
      const viewResponse = await gamesCommands.handleQueue(mockClient, mockChannel, mockUser, [
        'view',
      ]);
      expect(viewResponse).toBeDefined();
      expect(typeof viewResponse).toBe('string');
      expect(viewResponse.toLowerCase()).toContain('queue');
    });

    test('queue command handles invalid subcommands', async () => {
      const invalidResponse = await gamesCommands.handleQueue(mockClient, mockChannel, mockUser, [
        'invalid',
      ]);
      expect(invalidResponse).toBeDefined();
      expect(typeof invalidResponse).toBe('string');
      expect(invalidResponse.toLowerCase()).toContain('usage');
    });

    test('queue command handles no subcommand', async () => {
      const noSubcommandResponse = await gamesCommands.handleQueue(
        mockClient,
        mockChannel,
        mockUser,
        []
      );
      expect(noSubcommandResponse).toBeDefined();
      expect(typeof noSubcommandResponse).toBe('string');
      expect(noSubcommandResponse.toLowerCase()).toContain('usage');
    });
  });

  // Moderation Commands
  describe('Moderation Commands', () => {
    describe('Timeout Command', () => {
      test('mod can timeout a user', async () => {
        const targetUser = 'baduser';
        const response = await moderationCommands.handleTimeout(
          mockClient,
          mockChannel,
          mockModUser,
          [targetUser, '60']
        );

        expect(mockClient.timeout).toHaveBeenCalledWith(mockChannel, targetUser, 60);
        expect(response).toContain(targetUser);
        expect(response).toContain('timed out');
      });

      test('non-mod cannot timeout a user', async () => {
        const targetUser = 'baduser';
        const response = await moderationCommands.handleTimeout(mockClient, mockChannel, mockUser, [
          targetUser,
          '60',
        ]);

        expect(mockClient.timeout).not.toHaveBeenCalled();
        expect(response).toContain('only moderators');
      });

      test('handles invalid timeout duration', async () => {
        const targetUser = 'baduser';
        const response = await moderationCommands.handleTimeout(
          mockClient,
          mockChannel,
          mockModUser,
          [targetUser, 'invalid']
        );

        expect(mockClient.timeout).not.toHaveBeenCalled();
        expect(response).toContain('Invalid timeout duration');
      });
    });

    describe('Ban Command', () => {
      test('mod can ban a user', async () => {
        const targetUser = 'problematicuser';
        const response = await moderationCommands.handleBan(mockClient, mockChannel, mockModUser, [
          targetUser,
        ]);

        expect(mockClient.ban).toHaveBeenCalledWith(mockChannel, targetUser);
        expect(response).toContain(targetUser);
        expect(response).toContain('banned');
      });

      test('non-mod cannot ban a user', async () => {
        const targetUser = 'problematicuser';
        const response = await moderationCommands.handleBan(mockClient, mockChannel, mockUser, [
          targetUser,
        ]);

        expect(mockClient.ban).not.toHaveBeenCalled();
        expect(response).toContain('only moderators');
      });
    });

    describe('Unban Command', () => {
      test('mod can unban a user', async () => {
        const targetUser = 'unbanneduser';
        const response = await moderationCommands.handleUnban(
          mockClient,
          mockChannel,
          mockModUser,
          [targetUser]
        );

        expect(mockClient.say).toHaveBeenCalledWith(
          mockChannel,
          expect.stringContaining(targetUser)
        );
        expect(response).toContain(targetUser);
        expect(response).toContain('unbanned');
      });

      test('non-mod cannot unban a user', async () => {
        const targetUser = 'unbanneduser';
        const response = await moderationCommands.handleUnban(mockClient, mockChannel, mockUser, [
          targetUser,
        ]);

        expect(mockClient.say).not.toHaveBeenCalled();
        expect(response).toContain('only moderators');
      });
    });
  });

  // Error Handling
  describe('Error Handling', () => {
    test('handles undefined user gracefully', async () => {
      const response = await commands.handlePing(mockClient, mockChannel, undefined);
      expect(response).toBeDefined();
    });

    test('handles missing permissions gracefully', async () => {
      const response = await commands.handleTitle(mockClient, mockChannel, mockUser, 'New Title');
      expect(response).toContain('only') || expect(response).toBeNull();
    });

    test('handles invalid command arguments gracefully', async () => {
      const response = await commands.handleFollowMode(mockClient, mockChannel, mockModUser, []);
      expect(response).toBeDefined();
    });
  });
});

// Utils Tests
describe('Utils', () => {
  // Logger Tests
  describe('Logger Utility', () => {
    test('should create a logger instance', () => {
      expect(logger).toBeDefined();
    });

    test('should have correct log levels', () => {
      expect(logger.levels).toEqual(winston.config.npm.levels);
    });

    test('should have correct default level', () => {
      expect(logger.level).toBe('info');
    });

    test('should have helper methods', () => {
      expect(typeof logger.startupMessage).toBe('function');
      expect(typeof logger.sectionHeader).toBe('function');
      expect(typeof logger.debugObject).toBe('function');
    });

    test('startupMessage should log with separators', () => {
      const message = 'Test startup message';
      logger.startupMessage(message);
      expect(logger.info).toHaveBeenCalledWith(message);
    });

    test('sectionHeader should log with separators', () => {
      const message = 'Test section header';
      logger.sectionHeader(message);
      expect(logger.info).toHaveBeenCalledWith(message);
    });

    test('debugObject should log object with timestamp', () => {
      const label = 'Test label';
      const obj = { test: 'data' };
      logger.debugObject(label, obj);
      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining(label), obj);
    });

    test('should handle error logging', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', error);
      expect(logger.error).toHaveBeenCalledWith('Error occurred', error);
    });

    test('should handle object logging', () => {
      const obj = { key: 'value' };
      logger.info('Object log', obj);
      expect(logger.info).toHaveBeenCalledWith('Object log', obj);
    });
  });

  // Perplexity Tests
  describe('Perplexity Utility', () => {
    test('exists and has expected methods', () => {
      expect(perplexity).toBeDefined();
      expect(typeof perplexity.generateResponse).toBe('function');
    });

    test('generateResponse handles different input types', async () => {
      const testCases = [
        {
          prompt: 'Tell me a joke',
          context: undefined,
          expectedType: 'string',
        },
        {
          prompt: 'Explain quantum physics',
          context: 'For a high school student',
          expectedType: 'string',
        },
      ];

      for (const { prompt, context, expectedType } of testCases) {
        const response = await perplexity.generateResponse(prompt, context);
        expect(typeof response).toBe(expectedType);
        expect(response.length).toBeGreaterThan(0);
      }
    });

    test('handles empty prompt gracefully', async () => {
      await expect(perplexity.generateResponse('')).rejects.toThrow('Prompt cannot be empty');
    });

    test('handles very long prompts', async () => {
      const longPrompt = 'a'.repeat(10000);
      await expect(perplexity.generateResponse(longPrompt)).rejects.toThrow('Prompt is too long');
    });

    test('context parameter is optional', async () => {
      const prompt = 'What is the meaning of life?';
      const response1 = await perplexity.generateResponse(prompt);
      const response2 = await perplexity.generateResponse(prompt, 'Philosophical context');

      expect(response1).toBeDefined();
      expect(response2).toBeDefined();
      expect(typeof response1).toBe('string');
      expect(typeof response2).toBe('string');
    });

    test('handles network errors', async () => {
      // Simulate network error
      jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(perplexity.generateResponse('Simulate network error')).rejects.toThrow();

      // Restore console.error
      console.error.mockRestore();
    });
  });
});
