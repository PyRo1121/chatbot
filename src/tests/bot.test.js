import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import * as commands from '../bot/commands/index.js';

// Mock logger
jest.mock('../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    startupMessage: jest.fn(),
    sectionHeader: jest.fn(),
    debugObject: jest.fn(),
  },
}));

// Mock external dependencies
jest.mock('../bot/twitchClient.js');
jest.mock('../bot/analytics.js');
jest.mock('../bot/viewerManager.js');
jest.mock('../bot/moderationManager.js');
jest.mock('../bot/streamAnalytics.js');
jest.mock('../utils/gemini.js');
jest.mock('../auth/spotifyAuth.js', () => ({
  default: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    getCurrentTrack: jest.fn().mockResolvedValue({ name: 'Test Track', artist: 'Test Artist' }),
    skipTrack: jest.fn().mockResolvedValue(true),
    previousTrack: jest.fn().mockResolvedValue(true),
    pausePlayback: jest.fn().mockResolvedValue(true),
    resumePlayback: jest.fn().mockResolvedValue(true),
  })),
}));

describe('Bot Commands', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

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
