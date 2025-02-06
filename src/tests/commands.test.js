let enhancedCommands;
let analyticsCommands;
let clipManagementCommands;
let clipsCommands;
let followProtectionCommands;
let gamesCommands;
let moderationCommands;
let queueCommands;
let shoutoutCommands;
let streamHandlersCommands;
let streamInsightsCommands;
let triviaCommands;

beforeAll(async () => {
  analyticsCommands = await import('../bot/commands/analytics.js');
  clipManagementCommands = await import('../bot/commands/clipManagement.js');
  clipsCommands = await import('../bot/commands/clips.js');
  followProtectionCommands = await import('../bot/commands/followProtection.js');
  gamesCommands = await import('../bot/commands/games.js');
  moderationCommands = await import('../bot/commands/moderation.js');
  queueCommands = await import('../bot/commands/queue.js');
  shoutoutCommands = await import('../bot/commands/shoutout.js');
  streamHandlersCommands = await import('../bot/commands/streamHandlers.js');
  streamInsightsCommands = await import('../bot/commands/streamInsights.js');
  triviaCommands = await import('../bot/commands/trivia.js');
  enhancedCommands = await import('../bot/commands/enhancedCommands.js');
});

const { jest, describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Mock the Twitch client
const mockTwitchClient = {
  say: jest.fn(),
  whisper: jest.fn(),
  apiClient: {
    users: {
      getUserByName: jest.fn(),
    },
    streams: {
      getStreamByUserId: jest.fn(),
    },
    chat: {
      getChatters: jest.fn(),
    },
    channels: {
      updateChannelInfo: jest.fn(),
    },
    channelPoints: {
      createCustomReward: jest.fn(),
      updateCustomReward: jest.fn(),
      deleteCustomReward: jest.fn(),
      getCustomRewards: jest.fn(),
      updateRedemptionStatusByIds: jest.fn(),
    },
    moderation: {
      banUser: jest.fn(),
      unbanUser: jest.fn(),
      deleteChatMessages: jest.fn(),
    },
    clips: {
      createClip: jest.fn(),
    },
    videos: {
      getVideosByUserId: jest.fn(),
    },
    search: {
      searchCategories: jest.fn(),
      searchChannels: jest.fn(),
    },
    subscriptions: {
      getSubscriptionsByUserId: jest.fn(),
    },
    bits: {
      getCheermotes: jest.fn(),
    },
    extensions: {
      getLiveChannelsWithExtension: jest.fn(),
    },
  },
};

describe('Bot Commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockChannel = '#testchannel';
  const mockUser = {
    username: 'testuser',
    'display-name': 'TestUser',
    mod: false,
    subscriber: false,
    badges: {},
  };

  // Test cases for each command
  describe('handleRecommendations', () => {
    it('should return a message', async () => {
      const result = await analyticsCommands.handleRecommendations(
        mockTwitchClient,
        mockChannel,
        mockUser
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleViewerStats', () => {
    it('should return a message', async () => {
      const result = await analyticsCommands.handleViewerStats(
        mockTwitchClient,
        mockChannel,
        mockUser
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleLoyalty', () => {
    it('should return a message', async () => {
      const result = await analyticsCommands.handleLoyalty(mockTwitchClient, mockChannel, mockUser);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleTopViewers', () => {
    it('should return a message', async () => {
      const result = await analyticsCommands.handleTopViewers(
        mockTwitchClient,
        mockChannel,
        mockUser
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleRaids', () => {
    it('should return a message', async () => {
      const result = await analyticsCommands.handleRaids(mockTwitchClient, mockChannel, mockUser);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleHealth', () => {
    it('should return a message', async () => {
      const result = await analyticsCommands.handleHealth(mockTwitchClient, mockChannel, mockUser);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleStreamPerformance', () => {
    it('should return a message', async () => {
      const result = await analyticsCommands.handleStreamPerformance(
        mockTwitchClient,
        mockChannel,
        mockUser
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleBestTimes', () => {
    it('should return a message', async () => {
      const result = await analyticsCommands.handleBestTimes(
        mockTwitchClient,
        mockChannel,
        mockUser
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleTopCategories', () => {
    it('should return a message', async () => {
      const result = await analyticsCommands.handleTopCategories(
        mockTwitchClient,
        mockChannel,
        mockUser
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleAddCommand', () => {
    it('should return a success message', async () => {
      const result = await customCommands.handleAddCommand(
        'testuser',
        ['!test', 'This is a test command'],
        'mod'
      );
      expect(result).toBeDefined();
      expect(result.message).toContain('Command !test added');
    });
  });

  describe('handleRemoveCommand', () => {
    it('should return a success message', async () => {
      const result = await customCommands.handleRemoveCommand('testuser', ['!test'], 'mod');
      expect(result).toBeDefined();
      expect(result.message).toContain('Command !test removed');
    });
  });

  describe('handleListCommands', () => {
    it('should return a message', async () => {
      const result = await customCommands.handleListCommands();
      expect(result).toBeDefined();
      expect(typeof result.message).toBe('string');
    });
  });

  describe('handleUserCommands', () => {
    it('should return a message', async () => {
      const result = await customCommands.handleUserCommands();
      expect(result).toBeDefined();
      expect(typeof result.message).toBe('string');
    });
  });

  describe('handleModCommands', () => {
    it('should return a message', async () => {
      const result = await customCommands.handleModCommands('mod');
      expect(result).toBeDefined();
      expect(typeof result.message).toBe('string');
    });
  });

  describe('handleCreateClip', () => {
    it('should return a message', async () => {
      mockTwitchClient.apiClient.clips.createClip.mockResolvedValue('12345');
      const result = await clipManagementCommands.handleCreateClip(
        mockTwitchClient,
        mockChannel,
        mockUser,
        []
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleClipsByCategory', () => {
    it('should return a message', async () => {
      const result = await clipManagementCommands.handleClipsByCategory(
        mockTwitchClient,
        mockChannel,
        mockUser,
        []
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleClipsByTag', () => {
    it('should return a message', async () => {
      const result = await clipManagementCommands.handleClipsByTag(
        mockTwitchClient,
        mockChannel,
        mockUser,
        []
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleRecentClips', () => {
    it('should return a message', async () => {
      const result = await clipManagementCommands.handleRecentClips(
        mockTwitchClient,
        mockChannel,
        mockUser,
        []
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleTopClips', () => {
    it('should return a message', async () => {
      const result = await clipManagementCommands.handleTopClips(
        mockTwitchClient,
        mockChannel,
        mockUser
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleClipStats', () => {
    it('should return a message', async () => {
      const result = await clipManagementCommands.handleClipStats(
        mockTwitchClient,
        mockChannel,
        mockUser
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleSuggestCompilation', () => {
    it('should return a message', async () => {
      const result = await clipManagementCommands.handleSuggestCompilation(
        mockTwitchClient,
        mockChannel,
        mockUser
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleAnalyzeClip', () => {
    it('should return a message', async () => {
      const result = await clipManagementCommands.handleAnalyzeClip(
        mockTwitchClient,
        mockChannel,
        mockUser,
        []
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleClip', () => {
    it('should return a message', async () => {
      mockTwitchClient.apiClient.clips.createClip.mockResolvedValue('12345');
      const result = await clipsCommands.handleClip(mockTwitchClient, mockChannel, mockUser, []);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleHighlights', () => {
    it('should return a message', async () => {
      const result = await clipsCommands.handleHighlights(
        mockTwitchClient,
        mockChannel,
        mockUser,
        []
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleSuspiciousFollowers', () => {
    it('should return a message', async () => {
      const result = await followProtectionCommands.handleSuspiciousFollowers(
        mockTwitchClient,
        mockChannel,
        mockUser
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleClearSuspicious', () => {
    it('should return a message', async () => {
      const result = await followProtectionCommands.handleClearSuspicious(
        mockTwitchClient,
        mockChannel,
        mockUser
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleFollowSettings', () => {
    it('should return a message', async () => {
      const result = await followProtectionCommands.handleFollowSettings(
        mockTwitchClient,
        mockChannel,
        mockUser,
        []
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleFollowStats', () => {
    it('should return a message', async () => {
      const result = await followProtectionCommands.handleFollowStats(
        mockTwitchClient,
        mockChannel,
        mockUser
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleFollowCheck', () => {
    it('should return a message', async () => {
      const result = await followProtectionCommands.handleFollowCheck(
        mockTwitchClient,
        mockChannel,
        mockUser,
        []
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleFollowMode', () => {
    it('should return a message', async () => {
      const result = await followProtectionCommands.handleFollowMode(
        mockTwitchClient,
        mockChannel,
        mockUser,
        []
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleStartTrivia', () => {
    it('should return a message', async () => {
      const result = await gamesCommands.handleStartTrivia('testuser', [], 'mod');
      expect(result).toBeDefined();
      expect(typeof result.message).toBe('string');
    });
  });

  describe('handleStartWordChain', () => {
    it('should return a message', async () => {
      const result = await gamesCommands.handleStartWordChain('testuser', [], 'mod');
      expect(result).toBeDefined();
      expect(typeof result.message).toBe('string');
    });
  });

  describe('handleStartMiniGame', () => {
    it('should return a message', async () => {
      const result = await gamesCommands.handleStartMiniGame('testuser', [], 'mod');
      expect(result).toBeDefined();
      expect(typeof result.message).toBe('string');
    });
  });

  describe('handleAnswer', () => {
    it('should return a message or null', async () => {
      const result = await gamesCommands.handleAnswer('testuser', 'testanswer');
      expect(result === null || typeof result.message === 'string').toBeTruthy();
    });
  });

  describe('handleLurk', () => {
    it('should return a message', async () => {
      const result = await lurkCommands.handleLurk(mockTwitchClient, mockChannel, mockUser);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleModStats', () => {
    it('should return a message', async () => {
      const result = await moderationCommands.handleModStats(
        mockTwitchClient,
        mockChannel,
        mockUser
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleUserHistory', () => {
    it('should return a message', async () => {
      const result = await moderationCommands.handleUserHistory(
        mockTwitchClient,
        mockChannel,
        mockUser,
        []
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleTrust', () => {
    it('should return a message', async () => {
      const result = await moderationCommands.handleTrust(
        mockTwitchClient,
        mockChannel,
        mockUser,
        []
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleUntrust', () => {
    it('should return a message', async () => {
      const result = await moderationCommands.handleUntrust(
        mockTwitchClient,
        mockChannel,
        mockUser,
        []
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleRaidHistory', () => {
    it('should return a message', async () => {
      const result = await moderationCommands.handleRaidHistory(
        mockTwitchClient,
        mockChannel,
        mockUser
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleAnalyzeChat', () => {
    it('should return a message', async () => {
      const result = await moderationCommands.handleAnalyzeChat(
        mockTwitchClient,
        mockChannel,
        mockUser
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleWarn', () => {
    it('should return a message', async () => {
      const result = await moderationCommands.handleWarn(
        mockTwitchClient,
        mockChannel,
        mockUser,
        []
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handlePing', () => {
    it('should return a message', async () => {
      const result = await queueCommands.handlePing();
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleListQueue', () => {
    it('should return a message', async () => {
      const result = await queueCommands.handleListQueue();
      expect(result).toBeDefined();
      expect(typeof result.message).toBe('string');
    });
  });

  describe('handleClearQueue', () => {
    it('should return a message', async () => {
      const result = await queueCommands.handleClearQueue('testuser');
      expect(result).toBeDefined();
      expect(typeof result.message).toBe('string');
    });
  });

  describe('handleRemoveFromQueue', () => {
    it('should return a message', async () => {
      const result = await queueCommands.handleRemoveFromQueue('testuser', '1');
      expect(result).toBeDefined();
      expect(typeof result.message).toBe('string');
    });
  });

  describe('handleSongRequest', () => {
    it('should return a message', async () => {
      const result = await queueCommands.handleSongRequest(
        'testuser',
        'testsong',
        mockTwitchClient
      );
      expect(result).toBeDefined();
      expect(typeof result === 'object' ? result.message : result).toBe('string');
    });
  });

  describe('handleRoast', () => {
    it('should return a message', async () => {
      const result = await roastCommands.handleRoast(mockTwitchClient, mockChannel, mockUser, []);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleShoutout', () => {
    it('should return a message', async () => {
      const result = await shoutoutCommands.handleShoutout(
        mockTwitchClient,
        mockChannel,
        mockUser,
        []
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleChatActivity', () => {
    it('should return a message', async () => {
      const result = await streamHandlersCommands.handleChatActivity(
        mockTwitchClient,
        mockChannel,
        mockUser,
        'testmessage'
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleStreamStart', () => {
    it('should return a message', async () => {
      const result = await streamHandlersCommands.handleStreamStart(
        mockTwitchClient,
        mockChannel,
        mockUser
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleStreamEnd', () => {
    it('should return a message', async () => {
      const result = await streamHandlersCommands.handleStreamEnd(
        mockTwitchClient,
        mockChannel,
        mockUser
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleViewerUpdate', () => {
    it('should return a message', async () => {
      const result = await streamHandlersCommands.handleViewerUpdate(
        mockTwitchClient,
        mockChannel,
        100
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleRaidReceived', () => {
    it('should return a message', async () => {
      const result = await streamHandlersCommands.handleRaidReceived(
        mockTwitchClient,
        mockChannel,
        'testraider',
        10
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleMilestone', () => {
    it('should return a message', async () => {
      const result = await streamHandlersCommands.handleMilestone(
        mockTwitchClient,
        mockChannel,
        mockUser,
        'testdescription'
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleStreamHealth', () => {
    it('should return a message', async () => {
      const result = await streamHandlersCommands.handleStreamHealth(
        mockTwitchClient,
        mockChannel,
        mockUser
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleStreamStats', () => {
    it('should return a message', async () => {
      const result = await streamHandlersCommands.handleStreamStats(
        mockTwitchClient,
        mockChannel,
        mockUser
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleTitle', () => {
    it('should return a message', async () => {
      const result = await streamInsightsCommands.handleTitle(
        mockTwitchClient,
        mockChannel,
        mockUser,
        []
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleCategory', () => {
    it('should return a message', async () => {
      const result = await streamInsightsCommands.handleCategory(
        mockTwitchClient,
        mockChannel,
        mockUser,
        []
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleUptime', () => {
    it('should return a message', async () => {
      const result = await streamInsightsCommands.handleUptime(
        mockTwitchClient,
        mockChannel,
        mockUser
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleChatInsights', () => {
    it('should return a message', async () => {
      const result = await streamInsightsCommands.handleChatInsights(
        mockTwitchClient,
        mockChannel,
        mockUser
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleMood', () => {
    it('should return a message', async () => {
      const result = await enhancedCommands.handleMood(mockChannel, mockUser, []);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleEngagement', () => {
    it('should return a message', async () => {
      const result = await enhancedCommands.handleEngagement(mockChannel, mockUser, []);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleChatStats', () => {
    it('should return a message', async () => {
      const result = await enhancedCommands.handleChatStats(mockChannel, mockUser, []);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handlePoints', () => {
    it('should return a message', async () => {
      const result = await enhancedCommands.handlePoints(mockChannel, mockUser, []);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleLastActive', () => {
    it('should return a message', async () => {
      const result = await enhancedCommands.handleLastActive(mockChannel, mockUser, []);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleStreamSummary', () => {
    it('should return a message', async () => {
      const result = await enhancedCommands.handleStreamSummary(mockChannel, mockUser, []);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleContentInsights', () => {
    it('should return a message', async () => {
      const result = await enhancedCommands.handleContentInsights(mockChannel, mockUser, []);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('startTrivia', () => {
    it('should return a message', async () => {
      const result = await triviaCommands.startTrivia(mockTwitchClient, mockChannel, mockUser, []);
      expect(result).toBeDefined();
      expect(typeof result.message).toBe('string');
    });
  });

  describe('handleTriviaAnswer', () => {
    it('should return a message', async () => {
      const result = await triviaCommands.handleTriviaAnswer(
        mockTwitchClient,
        mockChannel,
        mockUser,
        []
      );
      expect(result).toBeDefined();
      expect(typeof result.message).toBe('string');
    });
  });

  describe('endTrivia', () => {
    it('should return a message', async () => {
      const result = await triviaCommands.endTrivia(mockTwitchClient, mockChannel, mockUser);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('listCategories', () => {
    it('should return a message', async () => {
      const result = await triviaCommands.listCategories();
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  // New test cases for untested commands
  describe('handleTitle', () => {
    it('should update stream title and return success message', async () => {
      mockTwitchClient.apiClient.channels.updateChannelInfo.mockResolvedValue(true);
      const result = await streamInsightsCommands.handleTitle(
        mockTwitchClient,
        mockChannel,
        mockUser,
        ['New Title']
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('Title updated');
    });
  });

  describe('handleCategory', () => {
    it('should update stream category and return success message', async () => {
      mockTwitchClient.apiClient.channels.updateChannelInfo.mockResolvedValue(true);
      const result = await streamInsightsCommands.handleCategory(
        mockTwitchClient,
        mockChannel,
        mockUser,
        ['New Category']
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('Category updated');
    });
  });

  describe('handleUptime', () => {
    it('should return stream uptime', async () => {
      mockTwitchClient.apiClient.streams.getStreamByUserId.mockResolvedValue({
        startedAt: new Date(Date.now() - 3600000)
      });
      const result = await streamInsightsCommands.handleUptime(
        mockTwitchClient,
        mockChannel,
        mockUser
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('Stream has been live for');
    });
  });

  describe('handleMilestone', () => {
    it('should create milestone and return success message', async () => {
      const result = await streamInsightsCommands.handleMilestone(
        mockTwitchClient,
        mockChannel,
        mockUser,
        ['New Milestone']
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('Milestone created');
    });
  });

  describe('handleChatInsights', () => {
    it('should return chat insights', async () => {
      mockTwitchClient.apiClient.chat.getChatters.mockResolvedValue({
        data: [{ user_login: 'testuser' }]
      });
      const result = await streamInsightsCommands.handleChatInsights(
        mockTwitchClient,
        mockChannel,
        mockUser
      );
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('Chat insights');
    });
  });
});
