import { jest, beforeAll, afterEach } from '@jest/globals';
import * as commands from '../bot/commands/index.js';
import {
  handleAnalytics,
  handleStreamInsights,
  handleContentOptimization,
  handleCommunityFeatures,
  handleCompetitorAnalysis,
  handleFollowProtection,
  handleShoutoutSystem,
  handleQueueSystem,
  handleTriviaSystem,
  handleStreamManagement,
  handleModerationSystem,
  handleClipManagement,
  handleBasicCommands,
  handleCustomCommands,
  handleViewerCommands,
  handleStreamCommands,
  handleModerationCommands,
  handleAnalyticsCommands,
  handleClipCommands,
  handleCompetitorCommands,
  handleTriviaCommands,
  handleQueueCommands,
  handleShoutoutCommands,
  handleFollowCommands,
} from '../bot/bot.js';
import { handleEngagementMetrics } from '../bot/commands/analyticsCommands.js';
import tokenManager from '../auth/tokenManager.js';
import TwitchClient from '../bot/twitchClient.js';
import logger from '../utils/logger.js';

// Mock external dependencies
jest.mock('../auth/tokenManager.js');
jest.mock('../bot/twitchClient.js');
jest.mock('../utils/logger.js');

describe('Command Tests', () => {
  let twitchClient;
  let commandRegistry;

  beforeAll(() => {
    // Setup command registry
    commandRegistry = {
      registerCommand: jest.fn(),
      getCommand: jest.fn(),
      validateCommand: jest.fn(),
      checkPermissions: jest.fn(),
      checkCooldown: jest.fn(),
      logCommandUsage: jest.fn(),
      getHelpText: jest.fn(),
    };
    // Setup Twitch client mock
    twitchClient = {
      initialize: jest.fn().mockResolvedValue(true),
      getUserInfo: jest.fn().mockResolvedValue({ id: '123', username: 'testuser' }),
      createClip: jest.fn().mockResolvedValue({ id: 'clip123', url: 'https://clip.url' }),
      getClips: jest.fn().mockResolvedValue([]),
      setTrustStatus: jest.fn().mockResolvedValue(true),
      updateStreamInfo: jest.fn().mockResolvedValue(true),
      getViewerStats: jest.fn().mockResolvedValue({
        totalViewers: 100,
        uniqueViewers: 50,
        averageViewTime: 30,
      }),
      getRecommendations: jest.fn().mockResolvedValue([
        { type: 'game', name: 'Game1', reason: 'Popular with your viewers' },
        { type: 'content', name: 'Clip Highlights', reason: 'High engagement' },
      ]),
    };
    TwitchClient.mockImplementation(() => twitchClient);

    // Mock valid bot token
    tokenManager.mockResolvedValue('valid_token_123');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    test('should initialize Twitch client with valid token', async () => {
      await twitchClient.initialize();
      expect(tokenManager).toHaveBeenCalled();
      expect(twitchClient.initialize).toHaveBeenCalledWith('valid_token_123');
    });

    test('should handle invalid tokens gracefully', async () => {
      tokenManager.mockResolvedValueOnce('invalid_token');
      twitchClient.initialize.mockRejectedValueOnce(new Error('Invalid token'));

      await expect(twitchClient.initialize()).rejects.toThrow('Invalid token');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid token'));
    });
  });

  describe('Basic Commands', () => {
    test('ping command should respond correctly', () => {
      const response = commands.handlePing();
      expect(response).toBe('Pong!');
      expect(commandRegistry.logCommandUsage).toHaveBeenCalledWith('ping');
    });

    test('ping command should handle null response', () => {
      jest.spyOn(commands, 'handlePing').mockReturnValueOnce(null);
      const response = commands.handlePing();
      expect(response).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('Ping command returned null');
    });

    test('ping command should handle error during execution', () => {
      jest.spyOn(commands, 'handlePing').mockImplementationOnce(() => {
        throw new Error('Ping failed');
      });
      expect(() => commands.handlePing()).toThrow('Ping failed');
      expect(logger.error).toHaveBeenCalledWith('Ping command error: Ping failed');
    });

    test('ping command should have help text', () => {
      commandRegistry.getHelpText.mockReturnValue('Responds with Pong!');
      const helpText = commandRegistry.getHelpText('ping');
      expect(helpText).toBe('Responds with Pong!');
    });

    test('ping command should respect cooldown', () => {
      commandRegistry.checkCooldown.mockReturnValueOnce(false);
      const response = commands.handlePing();
      expect(response).toContain('on cooldown');
      expect(commandRegistry.checkCooldown).toHaveBeenCalledWith('ping');
    });

    test('lurk command should personalize message', () => {
      const user = { username: 'testuser', displayName: 'Test User' };
      const response = commands.handleLurk(user);
      expect(response).toContain('Test User');
      expect(response).toContain('lurking');
    });

    test('roast command should target user and log request', () => {
      const response = commands.handleRoast('@targetuser', { username: 'requester' });
      expect(response).toContain('@targetuser');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Roast requested by requester')
      );
    });

    test('games command should list available games', () => {
      const response = commands.handleGames();
      expect(response).toContain('Available games');
      expect(commandRegistry.logCommandUsage).toHaveBeenCalledWith('games');
    });

    test('lurk command should handle anonymous lurkers', () => {
      const response = commands.handleLurk();
      expect(response).toContain('Someone is lurking');
      expect(commandRegistry.logCommandUsage).toHaveBeenCalledWith('lurk');
    });

    test('viewer commands should handle missing user info', () => {
      const response = commands.handleViewerCommands(null);
      expect(response).toContain('User information required');
    });
  });

  describe('Clip Management', () => {
    test('should create clip with title and attribution', async () => {
      const response = await commands.handleClip('Test Clip', { username: 'creator' });
      expect(response).toContain('Clip created: Test Clip');
      expect(twitchClient.createClip).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Clip created by creator'));
      expect(commandRegistry.checkPermissions).toHaveBeenCalledWith('clip', {
        username: 'creator',
      });
    });

    test('should handle empty clip title', async () => {
      const response = await commands.handleClip('', { username: 'creator' });
      expect(response).toContain('Clip created: Untitled');
      expect(twitchClient.createClip).toHaveBeenCalled();
    });

    test('should handle special characters in clip title', async () => {
      const response = await commands.handleClip('Test & Clip #123', { username: 'creator' });
      expect(response).toContain('Clip created: Test & Clip #123');
      expect(twitchClient.createClip).toHaveBeenCalled();
    });

    test('should handle concurrent clip creation', async () => {
      twitchClient.createClip.mockImplementationOnce(() => {
        return new Promise((resolve) => setTimeout(() => resolve({ id: 'clip123' }), 100));
      });
      
      const promises = [
        commands.handleClip('Clip 1'),
        commands.handleClip('Clip 2')
      ];
      
      const results = await Promise.all(promises);
      expect(results[0]).toContain('Clip created: Clip 1');
      expect(results[1]).toContain('Clip created: Clip 2');
      expect(twitchClient.createClip).toHaveBeenCalledTimes(2);
    });

    test('should validate clip title length', async () => {
      const longTitle = 'a'.repeat(101);
      await expect(commands.handleClip(longTitle)).rejects.toThrow('Clip title too long');
      expect(commandRegistry.validateCommand).toHaveBeenCalledWith(
        'clip',
        expect.objectContaining({ title: longTitle })
      );
    });

    test('should handle clip creation rate limiting', async () => {
      commandRegistry.checkCooldown.mockReturnValueOnce(false);
      const response = await commands.handleClip('Test Clip');
      expect(response).toContain('Clip creation on cooldown');
    });

    test('should return formatted highlights', async () => {
      const mockClips = [
        { title: 'Clip1', created_at: new Date(), view_count: 100 },
        { title: 'Clip2', created_at: new Date(), view_count: 200 },
      ];
      twitchClient.getClips.mockResolvedValue(mockClips);

      const response = await commands.handleHighlights(7);
      expect(response).toContain('Recent highlights');
      expect(response).toContain('Clip1');
      expect(response).toContain('100 views');
    });

    test('should handle clip creation errors', async () => {
      twitchClient.createClip.mockRejectedValueOnce(new Error('Clip creation failed'));
      await expect(commands.handleClip('Test Clip')).rejects.toThrow('Clip creation failed');
    });
  });

  describe('Moderation System', () => {
    test('should warn user with proper logging', () => {
      const response = commands.handleWarn('@user', 'Test warning', { username: 'moderator' });
      expect(response).toContain('@user has been warned');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Test warning'));
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Warning issued by moderator')
      );
      expect(commandRegistry.checkPermissions).toHaveBeenCalledWith('warn', {
        username: 'moderator',
      });
    });

    test('should handle multiple warnings for same user', () => {
      const response1 = commands.handleWarn('@user', 'First warning', { username: 'moderator' });
      const response2 = commands.handleWarn('@user', 'Second warning', { username: 'moderator' });
      
      expect(response1).toContain('First warning');
      expect(response2).toContain('Second warning');
      expect(logger.warn).toHaveBeenCalledTimes(2);
    });

    test('should escalate warnings to timeout', () => {
      // Mock that user has 3 previous warnings
      jest.spyOn(commandRegistry, 'getCommandHistory').mockReturnValueOnce([
        { command: 'warn', target: '@user' },
        { command: 'warn', target: '@user' },
        { command: 'warn', target: '@user' }
      ]);
      
      const response = commands.handleWarn('@user', 'Fourth warning', { username: 'moderator' });
      expect(response).toContain('@user has been timed out');
      expect(twitchClient.timeoutUser).toHaveBeenCalledWith('@user', 600);
    });

    test('should handle warning without reason', () => {
      const response = commands.handleWarn('@user', '', { username: 'moderator' });
      expect(response).toContain('@user has been warned');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('No reason provided'));
    });

    test('should prevent non-moderators from warning', () => {
      commandRegistry.checkPermissions.mockReturnValueOnce(false);
      const response = commands.handleWarn('@user', 'Test warning', { username: 'regularUser' });
      expect(response).toContain('You do not have permission');
      expect(logger.warn).not.toHaveBeenCalled();
    });

    test('should validate warn reason length', () => {
      const longReason = 'a'.repeat(201);
      const response = commands.handleWarn('@user', longReason, { username: 'moderator' });
      expect(response).toContain('Reason too long');
      expect(commandRegistry.validateCommand).toHaveBeenCalledWith(
        'warn',
        expect.objectContaining({ reason: longReason })
      );
    });

    test('should trust user and persist status', async () => {
      const response = await commands.handleTrust('@user', { username: 'moderator' });
      expect(response).toContain('@user trusted');
      expect(twitchClient.setTrustStatus).toHaveBeenCalledWith('@user', true);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Trust granted by moderator')
      );
    });

    test('should untrust user and persist status', async () => {
      const response = await commands.handleUntrust('@user', { username: 'moderator' });
      expect(response).toContain('@user untrusted');
      expect(twitchClient.setTrustStatus).toHaveBeenCalledWith('@user', false);
    });
  });

  describe('Stream Management', () => {
    test('should update stream title', async () => {
      const response = await commands.handleTitle('New Title');
      expect(response).toContain('Title updated to New Title');
      expect(twitchClient.updateStreamInfo).toHaveBeenCalled();
      expect(commandRegistry.checkPermissions).toHaveBeenCalledWith('title', expect.any(Object));
    });

    test('should validate title length', async () => {
      const longTitle = 'a'.repeat(141);
      await expect(commands.handleTitle(longTitle)).rejects.toThrow('Title too long');
      expect(commandRegistry.validateCommand).toHaveBeenCalledWith(
        'title',
        expect.objectContaining({ title: longTitle })
      );
    });

    test('should handle title update cooldown', async () => {
      commandRegistry.checkCooldown.mockReturnValueOnce(false);
      const response = await commands.handleTitle('New Title');
      expect(response).toContain('Title update on cooldown');
    });

    test('should update stream category', async () => {
      const response = await commands.handleCategory('Just Chatting');
      expect(response).toContain('Category updated to Just Chatting');
      expect(twitchClient.updateStreamInfo).toHaveBeenCalled();
    });

    test('should handle stream info update errors', async () => {
      twitchClient.updateStreamInfo.mockRejectedValueOnce(new Error('Update failed'));
      await expect(commands.handleTitle('New Title')).rejects.toThrow('Update failed');
    });
  });

  describe('Analytics & Insights', () => {
    test('should provide viewer statistics', async () => {
      const response = await commands.handleViewerStats();
      expect(response).toContain('Viewer statistics');
      expect(response).toContain('100 total viewers');
      expect(response).toContain('50 unique viewers');
      expect(commandRegistry.logCommandUsage).toHaveBeenCalledWith('viewerstats');
    });

    test('should handle analytics API failures', async () => {
      twitchClient.getViewerStats.mockRejectedValueOnce(new Error('API timeout'));
      const response = await commands.handleViewerStats();
      expect(response).toContain('Could not retrieve viewer stats');
      expect(logger.error).toHaveBeenCalledWith('Viewer stats API failure: API timeout');
    });

    test('should respect analytics command permissions', () => {
      commandRegistry.checkPermissions.mockReturnValueOnce(false);
      const response = commands.handleViewerStats();
      expect(response).toContain('You do not have permission');
    });

    test('should provide content recommendations', async () => {
      const response = await commands.handleRecommendations();
      expect(response).toContain('Content recommendations');
      expect(response).toContain('Game1');
      expect(response).toContain('Clip Highlights');
    });
  });

  describe('Trivia System', () => {
    test('should start trivia game with questions', async () => {
      const response = await commands.handleTriviaStart('category');
      expect(response).toContain('Trivia starting! Category: category');
      expect(twitchClient.startTrivia).toHaveBeenCalled();
      expect(commandRegistry.checkPermissions).toHaveBeenCalledWith('trivia', expect.any(Object));
    });

    test('should validate trivia category', async () => {
      await expect(commands.handleTriviaStart('invalid')).rejects.toThrow('Invalid category');
      expect(commandRegistry.validateCommand).toHaveBeenCalledWith(
        'trivia',
        expect.objectContaining({ category: 'invalid' })
      );
    });

    test('should handle trivia cooldown', async () => {
      commandRegistry.checkCooldown.mockReturnValueOnce(false);
      const response = await commands.handleTriviaStart('category');
      expect(response).toContain('Trivia on cooldown');
    });

    test('should validate correct answers', async () => {
      const response = await commands.handleTriviaAnswer('answer', { username: 'user' });
      expect(response).toContain('Correct!');
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Correct answer from user'));
    });
  });

  describe('Queue System', () => {
    test('should add to queue with position', async () => {
      const response = await commands.handleQueueAdd('item');
      expect(response).toContain('Added to queue');
      expect(response).toContain('Position 1');
      expect(commandRegistry.logCommandUsage).toHaveBeenCalledWith('queueadd');
    });

    test('should validate queue item length', async () => {
      const longItem = 'a'.repeat(101);
      await expect(commands.handleQueueAdd(longItem)).rejects.toThrow('Queue item too long');
      expect(commandRegistry.validateCommand).toHaveBeenCalledWith(
        'queueadd',
        expect.objectContaining({ item: longItem })
      );
    });

    test('should handle queue full scenario', async () => {
      twitchClient.getQueue.mockResolvedValueOnce(new Array(100).fill('item'));
      const response = await commands.handleQueueAdd('newItem');
      expect(response).toContain('Queue is full');
    });

    test('should list queue contents', async () => {
      const response = await commands.handleQueueList();
      expect(response).toContain('Current queue');
      expect(twitchClient.getQueue).toHaveBeenCalled();
    });

    test('should clear queue with confirmation', async () => {
      const response = await commands.handleQueueClear({ username: 'moderator' });
      expect(response).toContain('Queue cleared by moderator');
      expect(twitchClient.clearQueue).toHaveBeenCalled();
    });

    test('should remove specific queue items', async () => {
      const response = await commands.handleQueueRemove(2);
      expect(response).toContain('Removed item at position 2');
      expect(twitchClient.removeQueueItem).toHaveBeenCalledWith(2);
    });
  });

  describe('Shoutout System', () => {
    test('should generate personalized shoutout', async () => {
      const response = await commands.handleShoutout('targetChannel');
      expect(response).toContain('Check out targetChannel');
      expect(twitchClient.getChannelInfo).toHaveBeenCalled();
      expect(commandRegistry.checkPermissions).toHaveBeenCalledWith('shoutout', expect.any(Object));
    });

    test('should validate channel name format', async () => {
      await expect(commands.handleShoutout('invalid channel')).rejects.toThrow(
        'Invalid channel name'
      );
      expect(commandRegistry.validateCommand).toHaveBeenCalledWith(
        'shoutout',
        expect.objectContaining({ channel: 'invalid channel' })
      );
    });

    test('should handle shoutout cooldown', async () => {
      commandRegistry.checkCooldown.mockReturnValueOnce(false);
      const response = await commands.handleShoutout('targetChannel');
      expect(response).toContain('Shoutout on cooldown');
    });

    test('should handle missing channel info', async () => {
      twitchClient.getChannelInfo.mockResolvedValueOnce(null);
      const response = await commands.handleShoutout('invalidChannel');
      expect(response).toContain('Could not find channel info');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('invalidChannel'));
    });

    test('should include last stream metrics', async () => {
      twitchClient.getChannelInfo.mockResolvedValueOnce({
        title: 'Cool Stream',
        game: 'Just Chatting',
        viewers: 150,
      });
      const response = await commands.handleShoutout('activeChannel');
      expect(response).toContain('Last stream: Cool Stream');
      expect(response).toContain('150 viewers');
    });
  });

  describe('Follow Protection', () => {
    test('should enforce follow requirement', async () => {
      const response = await commands.handleFollowCheck('user');
      expect(response).toContain('must follow to participate');
      expect(twitchClient.checkFollowStatus).toHaveBeenCalled();
      expect(commandRegistry.logCommandUsage).toHaveBeenCalledWith('followcheck');
    });

    test('should handle follow API failures', async () => {
      twitchClient.checkFollowStatus.mockRejectedValueOnce(new Error('API timeout'));
      const response = await commands.handleFollowCheck('user');
      expect(response).toContain('Could not verify follow status');
      expect(logger.error).toHaveBeenCalledWith('Follow check API failure: API timeout');
    });

    test('should validate username format', async () => {
      await expect(commands.handleFollowCheck('invalid username')).rejects.toThrow(
        'Invalid username'
      );
      expect(commandRegistry.validateCommand).toHaveBeenCalledWith(
        'followcheck',
        expect.objectContaining({ username: 'invalid username' })
      );
    });
  });

  describe('Analytics Commands', () => {
    test('should provide engagement metrics', async () => {
      const response = await commands.handleEngagementMetrics();
      expect(response).toContain('Engagement metrics');
      expect(twitchClient.getEngagementData).toHaveBeenCalled();
      expect(commandRegistry.checkPermissions).toHaveBeenCalledWith(
        'analytics',
        expect.any(Object)
      );
    });

    test('should handle engagement API failures', async () => {
      twitchClient.getEngagementData.mockRejectedValueOnce(new Error('API timeout'));
      const response = await commands.handleEngagementMetrics();
      expect(response).toContain('Could not retrieve engagement data');
      expect(logger.error).toHaveBeenCalledWith('Engagement API failure: API timeout');
    });

    test('should respect analytics command permissions', () => {
      commandRegistry.checkPermissions.mockReturnValueOnce(false);
      const response = commands.handleEngagementMetrics();
      expect(response).toContain('You do not have permission');
    });
  });

  describe('Stream Insights', () => {
    test('should provide stream performance insights', async () => {
      const response = await commands.handleStreamInsights();
      expect(response).toContain('Stream insights');
      expect(twitchClient.getStreamMetrics).toHaveBeenCalled();
    });

    test('should handle stream insights API failures', async () => {
      twitchClient.getStreamMetrics.mockRejectedValueOnce(new Error('API timeout'));
      const response = await commands.handleStreamInsights();
      expect(response).toContain('Could not retrieve stream insights');
      expect(logger.error).toHaveBeenCalledWith('Stream insights API failure: API timeout');
    });

    test('should provide viewer retention analysis', async () => {
      const response = await commands.handleViewerRetention();
      expect(response).toContain('Viewer retention analysis');
      expect(twitchClient.getRetentionData).toHaveBeenCalled();
    });
  });

  describe('Content Optimization', () => {
    test('should provide content performance metrics', async () => {
      const response = await commands.handleContentMetrics();
      expect(response).toContain('Content performance');
      expect(twitchClient.getContentData).toHaveBeenCalled();
    });

    test('should handle content API failures', async () => {
      twitchClient.getContentData.mockRejectedValueOnce(new Error('API timeout'));
      const response = await commands.handleContentMetrics();
      expect(response).toContain('Could not retrieve content metrics');
      expect(logger.error).toHaveBeenCalledWith('Content API failure: API timeout');
    });

    test('should provide content recommendations', async () => {
      const response = await commands.handleContentRecommendations();
      expect(response).toContain('Content recommendations');
      expect(twitchClient.getRecommendations).toHaveBeenCalled();
    });
  });

  describe('Competitor Analysis', () => {
    test('should compare viewer metrics', async () => {
      const response = await commands.handleCompetitorCompare('competitor');
      expect(response).toContain('Comparison with competitor');
      expect(twitchClient.getCompetitorData).toHaveBeenCalled();
      expect(commandRegistry.checkPermissions).toHaveBeenCalledWith(
        'competitor',
        expect.any(Object)
      );
    });

    test('should validate competitor name format', async () => {
      await expect(commands.handleCompetitorCompare('invalid name')).rejects.toThrow(
        'Invalid competitor name'
      );
      expect(commandRegistry.validateCommand).toHaveBeenCalledWith(
        'competitor',
        expect.objectContaining({ name: 'invalid name' })
      );
    });

    test('should handle competitor data cooldown', async () => {
      commandRegistry.checkCooldown.mockReturnValueOnce(false);
      const response = await commands.handleCompetitorCompare('competitor');
      expect(response).toContain('Competitor data on cooldown');
    });

    test('should handle empty competitor data', async () => {
      twitchClient.getCompetitorData.mockResolvedValueOnce(null);
      const response = await commands.handleCompetitorCompare('emptyCompetitor');
      expect(response).toContain('No data available');
    });

    test('should analyze content differences', async () => {
      const response = await commands.handleCompetitorContentAnalysis('rivalStreamer');
      expect(response).toContain('Content analysis for rivalStreamer');
      expect(twitchClient.getContentMetrics).toHaveBeenCalled();
    });

    test('should show performance trends', async () => {
      const response = await commands.handleCompetitorTrends(7);
      expect(response).toContain('7-day performance trends');
      expect(twitchClient.getHistoricalData).toHaveBeenCalled();
    });

    test('should handle API failures gracefully', async () => {
      twitchClient.getCompetitorData.mockRejectedValueOnce(new Error('API timeout'));
      const response = await commands.handleCompetitorCompare('unstableCompetitor');
      expect(response).toContain('Could not retrieve competitor data');
      expect(logger.error).toHaveBeenCalledWith('Competitor API failure: API timeout');
    });
  });
});
