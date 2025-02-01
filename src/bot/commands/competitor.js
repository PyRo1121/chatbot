<<<<<<< HEAD
import logger from '../../utils/logger.js';

export default function setupCompetitorCommands(bot, competitorAnalysis) {
  return {
    trackChannel: {
      command: 'track',
      description: 'Track a competitor channel',
      permission: 'BROADCASTER',
      usage: '!track <channel>',
      execute: async (channel, user, message, args) => {
        if (!args[0]) {
          return bot.say(channel, 'Please specify a channel to track');
        }

        try {
          const success = await competitorAnalysis.addTrackedChannel(args[0]);
          if (success) {
            logger.info(`Started tracking channel: ${args[0]}`);
            return bot.say(channel, `Now tracking channel: ${args[0]}`);
          }
          logger.warn(`Failed to track channel: ${args[0]}`);
          return bot.say(channel, `Failed to track channel: ${args[0]}`);
        } catch (error) {
          logger.error(`Error tracking channel ${args[0]}: ${error.message}`);
          return bot.say(channel, `Error tracking channel: ${args[0]}`);
        }
      },
    },

    untrackChannel: {
      command: 'untrack',
      description: 'Stop tracking a competitor channel',
      permission: 'BROADCASTER',
      usage: '!untrack <channel>',
      execute: (channelName, user, message, args) => {
        if (!args[0]) {
          return bot.say(channelName, 'Please specify a channel to untrack');
        }

        try {
          const success = competitorAnalysis.removeTrackedChannel(args[0]);
          if (success) {
            logger.info(`Stopped tracking channel: ${args[0]}`);
            return bot.say(channelName, `Stopped tracking channel: ${args[0]}`);
          }
          logger.warn(`Channel not found in tracking list: ${args[0]}`);
          return bot.say(channelName, `Channel not found in tracking list: ${args[0]}`);
        } catch (error) {
          logger.error(`Error untracking channel ${args[0]}: ${error.message}`);
          return bot.say(channelName, `Error untracking channel: ${args[0]}`);
        }
      },
    },

    insights: {
      command: 'insights',
      description: 'Get insights about tracked competitors',
      permission: 'BROADCASTER',
      usage: '!insights',
      execute: (channelName) => {
        try {
          const insights = competitorAnalysis.getCompetitorInsights();
          logger.info('Competitor insights requested');

          // Format top categories
          const categories = insights.topCategories
            .map(({ category, count }) => `${category} (${count} channels)`)
            .join(', ');

          // Format fastest growing
          const growing = insights.fastestGrowing
            .map(({ channel, growthRate }) => `${channel} (+${growthRate}%)`)
            .join(', ');

          bot.say(channelName, `Top Categories: ${categories}`);
          bot.say(channelName, `Fastest Growing: ${growing}`);
        } catch (error) {
          logger.error(`Error getting competitor insights: ${error.message}`);
          bot.say(channelName, 'Error getting competitor insights');
        }
      },
    },

    suggestions: {
      command: 'suggestions',
      description: 'Get content suggestions based on competitor analysis',
      permission: 'BROADCASTER',
      usage: '!suggestions',
      execute: (channelName) => {
        try {
          const suggestions = competitorAnalysis.getContentSuggestions();
          logger.info('Content suggestions requested');

          for (const suggestion of suggestions) {
            bot.say(channelName, `${suggestion.message} - ${suggestion.reason}`);
          }
        } catch (error) {
          logger.error(`Error getting content suggestions: ${error.message}`);
          bot.say(channelName, 'Error getting content suggestions');
        }
      },
    },

    tracked: {
      command: 'tracked',
      description: 'List all tracked channels',
      permission: 'BROADCASTER',
      usage: '!tracked',
      execute: (channelName) => {
        try {
          const insights = competitorAnalysis.getCompetitorInsights();
          logger.info('Tracked channels list requested');

          const channels = insights.trackedChannels
            .map(
              ({ username, category, followers, avgViewers }) =>
                `${username} (${category}) - ${followers} followers, ${avgViewers} avg viewers`
            )
            .join(' | ');

          if (channels) {
            bot.say(channelName, `Tracked Channels: ${channels}`);
          } else {
            bot.say(channelName, 'No channels are currently being tracked');
          }
        } catch (error) {
          logger.error(`Error getting tracked channels: ${error.message}`);
          bot.say(channelName, 'Error getting tracked channels list');
        }
      },
    },
  };
}
=======
import logger from '../../utils/logger.js';

export default function setupCompetitorCommands(bot, competitorAnalysis) {
  return {
    trackChannel: {
      command: 'track',
      description: 'Track a competitor channel',
      permission: 'BROADCASTER',
      usage: '!track <channel>',
      execute: async (channel, user, message, args) => {
        if (!args[0]) {
          return bot.say(channel, 'Please specify a channel to track');
        }

        try {
          const success = await competitorAnalysis.addTrackedChannel(args[0]);
          if (success) {
            logger.info(`Started tracking channel: ${args[0]}`);
            return bot.say(channel, `Now tracking channel: ${args[0]}`);
          }
          logger.warn(`Failed to track channel: ${args[0]}`);
          return bot.say(channel, `Failed to track channel: ${args[0]}`);
        } catch (error) {
          logger.error(`Error tracking channel ${args[0]}: ${error.message}`);
          return bot.say(channel, `Error tracking channel: ${args[0]}`);
        }
      },
    },

    untrackChannel: {
      command: 'untrack',
      description: 'Stop tracking a competitor channel',
      permission: 'BROADCASTER',
      usage: '!untrack <channel>',
      execute: (channelName, user, message, args) => {
        if (!args[0]) {
          return bot.say(channelName, 'Please specify a channel to untrack');
        }

        try {
          const success = competitorAnalysis.removeTrackedChannel(args[0]);
          if (success) {
            logger.info(`Stopped tracking channel: ${args[0]}`);
            return bot.say(channelName, `Stopped tracking channel: ${args[0]}`);
          }
          logger.warn(`Channel not found in tracking list: ${args[0]}`);
          return bot.say(channelName, `Channel not found in tracking list: ${args[0]}`);
        } catch (error) {
          logger.error(`Error untracking channel ${args[0]}: ${error.message}`);
          return bot.say(channelName, `Error untracking channel: ${args[0]}`);
        }
      },
    },

    insights: {
      command: 'insights',
      description: 'Get insights about tracked competitors',
      permission: 'BROADCASTER',
      usage: '!insights',
      execute: (channelName) => {
        try {
          const insights = competitorAnalysis.getCompetitorInsights();
          logger.info('Competitor insights requested');

          // Format top categories
          const categories = insights.topCategories
            .map(({ category, count }) => `${category} (${count} channels)`)
            .join(', ');

          // Format fastest growing
          const growing = insights.fastestGrowing
            .map(({ channel, growthRate }) => `${channel} (+${growthRate}%)`)
            .join(', ');

          bot.say(channelName, `Top Categories: ${categories}`);
          bot.say(channelName, `Fastest Growing: ${growing}`);
        } catch (error) {
          logger.error(`Error getting competitor insights: ${error.message}`);
          bot.say(channelName, 'Error getting competitor insights');
        }
      },
    },

    suggestions: {
      command: 'suggestions',
      description: 'Get content suggestions based on competitor analysis',
      permission: 'BROADCASTER',
      usage: '!suggestions',
      execute: (channelName) => {
        try {
          const suggestions = competitorAnalysis.getContentSuggestions();
          logger.info('Content suggestions requested');

          for (const suggestion of suggestions) {
            bot.say(channelName, `${suggestion.message} - ${suggestion.reason}`);
          }
        } catch (error) {
          logger.error(`Error getting content suggestions: ${error.message}`);
          bot.say(channelName, 'Error getting content suggestions');
        }
      },
    },

    tracked: {
      command: 'tracked',
      description: 'List all tracked channels',
      permission: 'BROADCASTER',
      usage: '!tracked',
      execute: (channelName) => {
        try {
          const insights = competitorAnalysis.getCompetitorInsights();
          logger.info('Tracked channels list requested');

          const channels = insights.trackedChannels
            .map(
              ({ username, category, followers, avgViewers }) =>
                `${username} (${category}) - ${followers} followers, ${avgViewers} avg viewers`
            )
            .join(' | ');

          if (channels) {
            bot.say(channelName, `Tracked Channels: ${channels}`);
          } else {
            bot.say(channelName, 'No channels are currently being tracked');
          }
        } catch (error) {
          logger.error(`Error getting tracked channels: ${error.message}`);
          bot.say(channelName, 'Error getting tracked channels list');
        }
      },
    },
  };
}
>>>>>>> origin/master
