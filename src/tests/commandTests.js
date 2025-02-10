import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as commands from '../bot/commands/index.js';
import { TwitchClient } from '../bot/twitchClient.js';

// Mock data
const mockUser = {
  username: 'testuser',
  id: '12345',
  isMod: true,
};

const mockChannel = {
  name: 'testchannel',
  id: '67890',
};

describe('Bot Commands', () => {
  let twitchClient;
  let mockSendMessage;

  beforeEach(() => {
    twitchClient = new TwitchClient();
    mockSendMessage = jest.fn();
    twitchClient.sendMessage = mockSendMessage;
  });

  describe('Analytics Commands', () => {
    it('should return stream analytics summary', async () => {
      const response = await commands.analytics(twitchClient, mockUser, mockChannel);
      expect(response).toContain('Stream Analytics');
      expect(mockSendMessage).toHaveBeenCalled();
    });

    it('should handle analytics command with no data', async () => {
      const response = await commands.analytics(twitchClient, mockUser, mockChannel);
      expect(response).toContain('No analytics data available');
    });
  });

  describe('Clip Commands', () => {
    it('should create a clip successfully', async () => {
      const response = await commands.clip(twitchClient, mockUser, mockChannel);
      expect(response).toContain('Clip created');
      expect(mockSendMessage).toHaveBeenCalled();
    });

    it('should handle clip creation failure', async () => {
      jest.spyOn(twitchClient, 'createClip').mockRejectedValue(new Error('Clip failed'));
      const response = await commands.clip(twitchClient, mockUser, mockChannel);
      expect(response).toContain('Failed to create clip');
    });
  });

  describe('Competitor Commands', () => {
    it('should return competitor analysis', async () => {
      const response = await commands.competitor(twitchClient, mockUser, mockChannel);
      expect(response).toContain('Competitor Analysis');
      expect(mockSendMessage).toHaveBeenCalled();
    });

    it('should handle no competitors found', async () => {
      const response = await commands.competitor(twitchClient, mockUser, mockChannel);
      expect(response).toContain('No competitor data available');
    });
  });

  describe('Custom Commands', () => {
    it('should execute custom command successfully', async () => {
      const response = await commands.custom(twitchClient, mockUser, mockChannel, ['!test']);
      expect(response).toBeDefined();
      expect(mockSendMessage).toHaveBeenCalled();
    });

    it('should handle unknown custom command', async () => {
      const response = await commands.custom(twitchClient, mockUser, mockChannel, ['!unknown']);
      expect(response).toContain('Unknown command');
    });
  });

  describe('Follow Protection', () => {
    it('should enable follow protection', async () => {
      const response = await commands.followProtection(twitchClient, mockUser, mockChannel, ['on']);
      expect(response).toContain('Follow protection enabled');
    });

    it('should disable follow protection', async () => {
      const response = await commands.followProtection(twitchClient, mockUser, mockChannel, [
        'off',
      ]);
      expect(response).toContain('Follow protection disabled');
    });
  });

  describe('Game Commands', () => {
    it('should return current game info', async () => {
      const response = await commands.games(twitchClient, mockUser, mockChannel);
      expect(response).toContain('Current Game');
    });

    it('should handle game change', async () => {
      const response = await commands.games(twitchClient, mockUser, mockChannel, ['New Game']);
      expect(response).toContain('Game changed to');
    });
  });

  describe('Lurk Command', () => {
    it('should acknowledge lurk', async () => {
      const response = await commands.lurk(twitchClient, mockUser, mockChannel);
      expect(response).toContain('is now lurking');
    });
  });

  describe('Moderation Commands', () => {
    it('should timeout user successfully', async () => {
      const response = await commands.moderation(twitchClient, mockUser, mockChannel, [
        'timeout',
        'testuser',
        '10',
      ]);
      expect(response).toContain('has been timed out');
    });

    it('should ban user successfully', async () => {
      const response = await commands.moderation(twitchClient, mockUser, mockChannel, [
        'ban',
        'testuser',
      ]);
      expect(response).toContain('has been banned');
    });
  });

  describe('Ping Command', () => {
    it('should respond with pong', async () => {
      const response = await commands.ping(twitchClient, mockUser, mockChannel);
      expect(response).toBe('pong');
    });
  });

  describe('Queue Commands', () => {
    it('should add to queue', async () => {
      const response = await commands.queue(twitchClient, mockUser, mockChannel, [
        'add',
        'testitem',
      ]);
      expect(response).toContain('added to queue');
    });

    it('should show queue', async () => {
      const response = await commands.queue(twitchClient, mockUser, mockChannel, ['list']);
      expect(response).toContain('Current queue');
    });
  });

  describe('Roast Command', () => {
    it('should return roast message', async () => {
      const response = await commands.roast(twitchClient, mockUser, mockChannel, ['testuser']);
      expect(response).toContain('roasts');
    });
  });

  describe('Shoutout Command', () => {
    it('should give shoutout', async () => {
      const response = await commands.shoutout(twitchClient, mockUser, mockChannel, ['testuser']);
      expect(response).toContain('Check out');
    });
  });

  describe('Stream Handlers', () => {
    it('should handle stream start', async () => {
      const response = await commands.streamHandlers(twitchClient, 'start');
      expect(response).toContain('Stream started');
    });

    it('should handle stream end', async () => {
      const response = await commands.streamHandlers(twitchClient, 'end');
      expect(response).toContain('Stream ended');
    });
  });

  describe('Stream Insights', () => {
    it('should return stream insights', async () => {
      const response = await commands.streamInsights(twitchClient, mockUser, mockChannel);
      expect(response).toContain('Stream Insights');
    });
  });

  describe('Trivia Commands', () => {
    it('should start trivia', async () => {
      const response = await commands.trivia(twitchClient, mockUser, mockChannel, ['start']);
      expect(response).toContain('Trivia started');
    });

    it('should stop trivia', async () => {
      const response = await commands.trivia(twitchClient, mockUser, mockChannel, ['stop']);
      expect(response).toContain('Trivia stopped');
    });
  });

  describe('Viewer Commands', () => {
    it('should return viewer count', async () => {
      const response = await commands.viewer(twitchClient, mockUser, mockChannel);
      expect(response).toContain('Current viewers');
    });

    it('should return top viewers', async () => {
      const response = await commands.viewer(twitchClient, mockUser, mockChannel, ['top']);
      expect(response).toContain('Top viewers');
    });
  });
});
