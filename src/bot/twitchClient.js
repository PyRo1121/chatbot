import tmi from 'tmi.js';
import { ApiClient } from '@twurple/api';
import { RefreshingAuthProvider } from '@twurple/auth';
import logger from '../utils/logger.js';
import { OpenAI } from 'openai';
import tokenManager from '../auth/tokenManager.js';

class TwitchClient {
  // Stream analytics data
  streamAnalytics = {
    totalStreams: 0,
    totalHours: 0,
    averageViewers: 0,
    peakViewers: 0,
    gamesPlayed: new Map(),
    bestTimes: new Map(),
    lastStream: null,
  };

  // Twitch API client
  twitchApi = null;
  constructor() {
    // Initialize Twitch API with bot credentials
    const authProvider = new RefreshingAuthProvider(
      {
        clientId: process.env.TWITCH_BOT_CLIENT_ID,
        clientSecret: process.env.TWITCH_BOT_CLIENT_SECRET,
        onRefresh: async (newTokenData) => {
          try {
            // Update tokens using tokenManager
            await tokenManager.updateEnvFile({
              TWITCH_BOT_ACCESS_TOKEN: newTokenData.accessToken,
              TWITCH_OAUTH_TOKEN: `oauth:${newTokenData.accessToken}`,
              ...(newTokenData.refreshToken && {
                TWITCH_BOT_REFRESH_TOKEN: newTokenData.refreshToken,
              }),
            });

            // Update environment variables in memory
            process.env.TWITCH_BOT_ACCESS_TOKEN = newTokenData.accessToken;
            process.env.TWITCH_OAUTH_TOKEN = `oauth:${newTokenData.accessToken}`;
            if (newTokenData.refreshToken) {
              process.env.TWITCH_BOT_REFRESH_TOKEN = newTokenData.refreshToken;
            }

            logger.info('Twitch token refreshed successfully via auth provider');
          } catch (error) {
            logger.error('Error in auth provider refresh:', error);
            throw error;
          }
        },
      },
      {
        accessToken: process.env.TWITCH_BOT_ACCESS_TOKEN,
        refreshToken: process.env.TWITCH_BOT_REFRESH_TOKEN,
        expiresIn: 0,
        obtainmentTimestamp: 0,
      }
    );

    this.twitchApi = new ApiClient({ authProvider });

    // Initialize chat client
    this.client = new tmi.Client({
      options: { debug: true },
      identity: {
        username: process.env.TWITCH_BOT_USERNAME,
        password: process.env.TWITCH_OAUTH_TOKEN,
      },
      channels: [`#${process.env.TWITCH_CHANNEL}`],
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.client.on('message', this.handleError(this.onMessageHandler.bind(this)));
    this.client.on('subscription', this.handleError(this.onSubscription.bind(this)));
    this.client.on('resub', this.handleError(this.onResub.bind(this)));
    this.client.on('raid', this.handleError(this.onRaid.bind(this)));
    this.client.on('follow', this.handleError(this.onFollow.bind(this)));
    this.client.on('error', this.handleTwitchError.bind(this));
  }

  async generateResponse(prompt) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a funny Twitch chat bot. Keep responses short and entertaining.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 100,
      });
      return completion.choices[0].message.content;
    } catch (error) {
      logger.error('OpenAI error:', error);
      return 'Thanks for the support!';
    }
  }

  handleError(handler) {
    return async (...args) => {
      try {
        await handler(...args);
      } catch (error) {
        const wasRefreshed = await tokenManager.handleTokenError(error);
        if (wasRefreshed) {
          // Retry the operation with new token
          try {
            await handler(...args);
          } catch (retryError) {
            logger.error('Error after token refresh:', retryError);
          }
        } else {
          logger.error('Error in event handler:', error);
        }
      }
    };
  }

  async handleTwitchError(error) {
    logger.error('Twitch client error:', error);
    await tokenManager.handleTokenError(error);
  }

  async onMessageHandler(channel, tags, message, self) {
    if (self) {
      return;
    }

    // Welcome new chatters
    if (tags['first-msg']) {
      const response = await this.generateResponse(
        'Generate a funny welcome message for a first-time chatter'
      );
      this.client.say(channel, `Welcome @${tags.username}! ${response}`);
      return;
    }

    // Handle analytics commands first
    if (message.startsWith('!stats')) {
      await this.handleStatsCommand(channel);
      return;
    }
    if (message.startsWith('!besttimes')) {
      await this.handleBestTimesCommand(channel);
      return;
    }
    if (message.startsWith('!history')) {
      await this.handleHistoryCommand(channel);
      return;
    }

    // Respond to other commands
    if (message.startsWith('!hello')) {
      const response = await this.generateResponse(
        'Generate a funny response to someone saying hello'
      );
      this.client.say(channel, `@${tags.username}, ${response}`);
    }
  }

  async handleStatsCommand(channel) {
    try {
      // Remove # from channel name
      const channelName = channel.replace('#', '');
      const stream = await this.twitchApi.streams.getStreamByUserName(channelName);
      if (stream) {
        const game = await stream.getGame();
        const stats = `
          Current Stream Stats:
          - Game: ${game?.name || 'Unknown'}
          - Viewers: ${stream.viewers}
          - Started: ${stream.startDate.toLocaleString()}
          - Uptime: ${this.formatDuration(stream.startDate)}
        `;
        this.client.say(channel, stats);
      } else {
        this.client.say(channel, 'No active stream found');
      }
    } catch (error) {
      logger.error('Error fetching stream stats:', error);
      this.client.say(
        channel,
        'Error fetching stream stats. Make sure your Twitch API credentials are correct'
      );
    }
  }

  async updateStreamAnalytics() {
    try {
      const channelName = process.env.TWITCH_CHANNEL.replace('#', '');
      const stream = await this.twitchApi.streams.getStreamByUserName(channelName);
      if (stream) {
        const game = await stream.getGame();
        const gameName = game?.name || 'Unknown';

        // Update game stats
        const gameCount = this.streamAnalytics.gamesPlayed.get(gameName) || 0;
        this.streamAnalytics.gamesPlayed.set(gameName, gameCount + 1);

        // Update viewer stats
        this.streamAnalytics.averageViewers = Math.round(
          (this.streamAnalytics.averageViewers * this.streamAnalytics.totalStreams +
            stream.viewers) /
            (this.streamAnalytics.totalStreams + 1)
        );
        this.streamAnalytics.peakViewers = Math.max(
          this.streamAnalytics.peakViewers,
          stream.viewers
        );

        // Update time stats
        const hour = stream.startDate.getHours();
        const hourCount = this.streamAnalytics.bestTimes.get(hour) || 0;
        this.streamAnalytics.bestTimes.set(hour, hourCount + 1);

        // Update overall stats
        this.streamAnalytics.totalStreams++;
        this.streamAnalytics.lastStream = stream.startDate;
      }
    } catch (error) {
      logger.error('Error updating stream analytics:', error);
    }
  }

  formatDuration(startDate) {
    const diff = Date.now() - startDate.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  async handleBestTimesCommand(channel) {
    // Update analytics before showing best times
    await this.updateStreamAnalytics();
    try {
      if (this.streamAnalytics.bestTimes.size === 0) {
        this.client.say(channel, 'Not enough data to determine best times yet');
        return;
      }

      // Convert map to array and sort by count
      const sortedTimes = [...this.streamAnalytics.bestTimes.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      const bestTimes = sortedTimes
        .map(([hour, count]) => {
          const time = new Date();
          time.setHours(hour);
          return `${time.toLocaleTimeString([], { hour: '2-digit' })} (${count} streams)`;
        })
        .join(', ');

      this.client.say(channel, `Best streaming times: ${bestTimes}`);
    } catch (error) {
      logger.error('Error handling best times command:', error);
      this.client.say(channel, 'Error getting best times');
    }
  }

  async handleHistoryCommand(channel) {
    // Update analytics before showing history
    await this.updateStreamAnalytics();
    try {
      if (this.streamAnalytics.totalStreams === 0) {
        this.client.say(channel, 'No stream history available yet');
        return;
      }

      // Get most played games
      const sortedGames = [...this.streamAnalytics.gamesPlayed.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      const stats = `
        Stream History:
        - Total streams: ${this.streamAnalytics.totalStreams}
        - Average viewers: ${this.streamAnalytics.averageViewers}
        - Peak viewers: ${this.streamAnalytics.peakViewers}
        - Most played games: ${sortedGames.map(([game, count]) => `${game} (${count}x)`).join(', ')}
        - Last stream: ${this.streamAnalytics.lastStream ? this.streamAnalytics.lastStream.toLocaleDateString() : 'N/A'}
      `;

      this.client.say(channel, stats);
    } catch (error) {
      logger.error('Error handling history command:', error);
      this.client.say(channel, 'Error getting stream history');
    }
  }

  async onSubscription(channel, username, method, message, userstate) {
    const badges = userstate?.badges ? Object.keys(userstate.badges).join(', ') : 'none';
    const response = await this.generateResponse(
      `Generate a funny thank you message for a new Twitch subscriber who subscribed using ${method}${message ? ` and said: ${message}` : ''} (badges: ${badges})`
    );
    this.client.say(channel, `@${username}, ${response}`);
  }

  async onResub(channel, username, months, message, userstate, methods) {
    const badges = userstate?.badges ? Object.keys(userstate.badges).join(', ') : 'none';
    const subPlan = methods?.plan || 'unknown';
    const response = await this.generateResponse(
      `Generate a funny thank you message for someone resubscribing for ${months} months with ${subPlan} plan${message ? ` who said: ${message}` : ''} (badges: ${badges})`
    );
    this.client.say(channel, `@${username}, ${response} Thanks for ${months} amazing months!`);
  }

  async onRaid(channel, username, viewers) {
    const response = await this.generateResponse(
      `Generate a funny welcome message for a Twitch raid with ${viewers} viewers`
    );
    this.client.say(channel, `@${username} is raiding with ${viewers} viewers! ${response}`);
  }

  async onFollow(channel, username, userstate) {
    const badges = userstate?.badges ? Object.keys(userstate.badges).join(', ') : 'none';
    const response = await this.generateResponse(
      `Generate a funny thank you message for a new Twitch follower. Include their chat color: ${userstate?.color || 'default'} and badges: ${badges}`
    );
    this.client.say(channel, `@${username}, ${response}`);
  }

  connect() {
    return this.client.connect();
  }
}

export default new TwitchClient();
