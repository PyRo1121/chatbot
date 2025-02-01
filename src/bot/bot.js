import getClient from './twitchClient.js';
import analytics from './analytics.js';
import chatInteraction from './chatInteraction.js';
import CompetitorAnalysis from './competitorAnalysis.js';
import AdvancedModeration from './advancedModeration.js';
import StreamAutomation from './streamAutomation.js';
import {
<<<<<<< HEAD
  processSongQueue,
=======
>>>>>>> origin/master
  handleChatActivity,
  streamEventHandlers,
  handleClip,
  handleHighlights,
  handleTitle,
  handleCategory,
  handleUptime,
  handleMilestone,
  handleSuspiciousFollowers,
  handleClearSuspicious,
  handleFollowSettings,
  handleRecommendations,
  handleViewerStats,
  handleLoyalty,
  handleTopViewers,
  handleRaids,
  handleRaid,
  trackViewer,
  handleHealth,
  handleStreamPerformance,
  handleBestTimes,
  handleTopCategories,
  initializeAnalytics,
  endAnalytics,
  handleCreateClip,
  handleClipsByCategory,
  handleClipsByTag,
  handleRecentClips,
  handleTopClips,
  handleClipStats,
  handleSuggestCompilation,
  handleAnalyzeClip,
  handleModStats,
  handleUserHistory,
  handleTrust,
  handleUntrust,
  handleRaidHistory,
  handleAnalyzeChat,
  handleWarn,
  moderateMessage,
  assessRaid,
  competitorCommands,
  handleShoutout,
  startTrivia,
  handleTriviaAnswer,
  endTrivia,
} from './commands/index.js';
<<<<<<< HEAD
import { detectHighlight } from './streamManager.js';
=======
import { detectHighlight, streamCommands } from './streamManager.js';
>>>>>>> origin/master

async function initBot() {
  const twitchClient = await getClient();

  // Initialize advanced moderation
  const advancedModeration = new AdvancedModeration();

  // Initialize stream automation
  const streamAutomation = new StreamAutomation();
  await streamAutomation.init();

  // Initialize competitor analysis
  const competitorAnalysis = new CompetitorAnalysis();

  // Start analytics tracking
  analytics.startStream();
  initializeAnalytics();

  // Register stream event handlers
  streamEventHandlers.onStreamStart();

  // Setup command handlers
  twitchClient.client.on('message', async (channel, user, message, self) => {
    if (self) {
      return;
    }

    // Handle chat engagement and points
    const engagementResponse = await chatInteraction.handleChatMessage(user.username, message);
    if (engagementResponse) {
      twitchClient.client.say(channel, engagementResponse);
    }

    // Track viewer milestones
    const milestone = trackViewer(user.username);
    if (milestone) {
      twitchClient.client.say(channel, milestone);
    }

    // Advanced moderation checks
    const advancedModAction = await advancedModeration.analyzeMessage(message, user);
    if (advancedModAction) {
      switch (advancedModAction.action) {
        case 'warning':
          twitchClient.client.say(channel, `⚠️ @${user.username}, ${advancedModAction.reason}`);
          break;
        case 'timeout':
          twitchClient.client.timeout(
            channel,
            user.username,
            advancedModAction.duration,
            advancedModAction.reason
          );
          break;
        case 'ban':
          twitchClient.client.ban(channel, user.username, advancedModAction.reason);
          break;
        case 'shadowban':
          advancedModeration.shadowbanUser(user.username);
          break;
      }
      return;
    }

    // Basic moderation
    const modAction = await moderateMessage(message, user.username, user.mod ? 'mod' : 'user');
    if (modAction) {
      switch (modAction.action) {
        case 'warning':
          twitchClient.client.say(channel, `⚠️ @${user.username}, ${modAction.reason}`);
          break;
        case 'timeout':
          twitchClient.client.timeout(channel, user.username, modAction.duration, modAction.reason);
          break;
        case 'ban':
          twitchClient.client.ban(channel, user.username, modAction.reason);
          break;
      }
      return;
    }

    // Check for potential highlight moment
    const chatStats = chatInteraction.getStats();
    const viewerCount = 0; // This should be fetched from Twitch API
    const isHighlight = await detectHighlight(message, viewerCount, chatStats.totalInteractions);
    if (isHighlight) {
      twitchClient.client.say(channel, '📸 This moment has been marked as a stream highlight!');
    }

    // Handle chat activity for auto-clips
    await handleChatActivity(twitchClient.client, channel, user, message);

    // Handle commands
    const [command] = message.toLowerCase().split(' ');
    const args = message.slice(command.length).trim();

    // Response variables for follow protection commands
    let suspiciousResponse, clearResponse, settingsResponse;

    // Check broadcaster status (both by badge and username)
    const isBroadcaster =
      user.badges?.broadcaster === '1' || user.username === channel.replace('#', '');

    switch (command) {
      case '!clip':
        await handleClip(twitchClient.client, channel, user, args);
        break;
      case '!highlights':
        await handleHighlights(twitchClient.client, channel, user, args);
        break;
      case '!title':
        if (user.isBroadcaster || user.isMod) {
          await handleTitle(twitchClient.client, channel, user, args);
        }
        break;
      case '!category':
        if (user.isBroadcaster || user.isMod) {
          await handleCategory(twitchClient.client, channel, user, args);
        }
        break;
      case '!uptime':
        await handleUptime(twitchClient.client, channel, user, args);
        break;
      case '!milestone':
        if (user.isBroadcaster || user.isMod) {
          await handleMilestone(twitchClient.client, channel, user, args);
        }
        break;
      case '!suspicious':
        suspiciousResponse = await handleSuspiciousFollowers(
          twitchClient.client,
          channel,
          user,
          args,
          isBroadcaster
        );
        if (suspiciousResponse) {
          twitchClient.client.say(channel, suspiciousResponse.message);
        }
        break;
      case '!clearsuspicious':
        clearResponse = await handleClearSuspicious(
          twitchClient.client,
          channel,
          user,
          args,
          isBroadcaster
        );
        if (clearResponse) {
          twitchClient.client.say(channel, clearResponse.message);
        }
        break;
      case '!followsettings':
        settingsResponse = await handleFollowSettings(
          twitchClient.client,
          channel,
          user,
          args,
          isBroadcaster
        );
        if (settingsResponse) {
          twitchClient.client.say(channel, settingsResponse.message);
        }
        break;
      case '!chatinsights':
        handleChatInsights(twitchClient.client, channel);
        break;
      case '!recommendations': {
        const recResponse = await handleRecommendations();
        twitchClient.client.say(channel, recResponse);
        break;
      }
      case '!health': {
        const healthResponse = await handleHealth();
        twitchClient.client.say(channel, healthResponse);
        break;
      }
      case '!performance': {
        const perfResponse = await handleStreamPerformance();
        twitchClient.client.say(channel, perfResponse);
        break;
      }
      case '!besttimes': {
        const timesResponse = await handleBestTimes();
        twitchClient.client.say(channel, timesResponse);
        break;
      }
      case '!topcategories': {
        const catResponse = await handleTopCategories();
        twitchClient.client.say(channel, catResponse);
        break;
      }
      case '!viewerstats': {
        const statsResponse = await handleViewerStats();
        twitchClient.client.say(channel, statsResponse);
        break;
      }
      case '!loyalty': {
        const loyaltyResponse = await handleLoyalty();
        twitchClient.client.say(channel, loyaltyResponse);
        break;
      }
      case '!points':
      case '!lastactive':
      case '!chatstats': {
        const commandHandler = chatInteraction.chatCommands[command];
        if (commandHandler) {
          const response = await commandHandler(user.username);
          twitchClient.client.say(channel, response);
        }
        break;
      }
      case '!topviewers': {
        const topResponse = await handleTopViewers();
        twitchClient.client.say(channel, topResponse);
        break;
      }
      case '!raids': {
        const raidsResponse = await handleRaids();
        twitchClient.client.say(channel, raidsResponse);
        break;
      }
      case '!modstats': {
        if (user.mod || isBroadcaster) {
          const statsResponse = await handleModStats();
          twitchClient.client.say(channel, statsResponse);
        }
        break;
      }
      case '!userhistory': {
        if (user.mod || isBroadcaster) {
          if (!args) {
            twitchClient.client.say(channel, 'Please specify a username');
            break;
          }
          const historyResponse = await handleUserHistory(args);
          twitchClient.client.say(channel, historyResponse);
        }
        break;
      }
      case '!trust': {
        if (user.mod || isBroadcaster) {
          if (!args) {
            twitchClient.client.say(channel, 'Please specify a username');
            break;
          }
          const trustResponse = await handleTrust(args);
          twitchClient.client.say(channel, trustResponse);
        }
        break;
      }
      case '!untrust': {
        if (user.mod || isBroadcaster) {
          if (!args) {
            twitchClient.client.say(channel, 'Please specify a username');
            break;
          }
          const untrustResponse = await handleUntrust(args);
          twitchClient.client.say(channel, untrustResponse);
        }
        break;
      }
      case '!raidhistory': {
        if (user.mod || isBroadcaster) {
          const raidHistoryResponse = await handleRaidHistory();
          twitchClient.client.say(channel, raidHistoryResponse);
        }
        break;
      }
      case '!analyzechat': {
        if (user.mod || isBroadcaster) {
          const analysisResponse = await handleAnalyzeChat();
          twitchClient.client.say(channel, analysisResponse);
        }
        break;
      }
      case '!warn': {
        if (user.mod || isBroadcaster) {
          const [warnUser, ...reasonParts] = args.split(' ');
          if (!warnUser || reasonParts.length === 0) {
            twitchClient.client.say(channel, 'Please specify a username and reason');
            break;
          }
          const warnResponse = await handleWarn(warnUser, reasonParts.join(' '));
          twitchClient.client.say(channel, warnResponse);
        }
        break;
      }
      case '!createclip': {
        const clipResponse = await handleCreateClip(twitchClient.client, channel, user, args);
        twitchClient.client.say(channel, clipResponse);
        break;
      }
      case '!clipsbycategory': {
        if (!args) {
          twitchClient.client.say(channel, 'Please specify a category');
          break;
        }
        const categoryResponse = await handleClipsByCategory(args);
        twitchClient.client.say(channel, categoryResponse);
        break;
      }
      case '!clipsbytag': {
        if (!args) {
          twitchClient.client.say(channel, 'Please specify a tag');
          break;
        }
        const tagResponse = await handleClipsByTag(args);
        twitchClient.client.say(channel, tagResponse);
        break;
      }
      case '!recentclips': {
        const days = args ? parseInt(args) : 7;
        const recentResponse = await handleRecentClips(days);
        twitchClient.client.say(channel, recentResponse);
        break;
      }
      case '!topclips': {
        const topResponse = await handleTopClips();
        twitchClient.client.say(channel, topResponse);
        break;
      }
      case '!clipstats': {
        const statsResponse = await handleClipStats();
        twitchClient.client.say(channel, statsResponse);
        break;
      }
      case '!suggestcompilation': {
        const compilationResponse = await handleSuggestCompilation();
        twitchClient.client.say(channel, compilationResponse);
        break;
      }
      case '!analyzeclip': {
        if (!args) {
          twitchClient.client.say(channel, 'Please specify a clip ID');
          break;
        }
        const analysisResponse = await handleAnalyzeClip(args);
        twitchClient.client.say(channel, analysisResponse);
        break;
      }
      case '!trivia': {
        if (user.mod || isBroadcaster) {
          const triviaResponse = await startTrivia(twitchClient.client, channel, user, args);
          twitchClient.client.say(channel, triviaResponse);
        }
        break;
      }
      case '!answer': {
        const answerResponse = await handleTriviaAnswer(twitchClient.client, channel, user, args);
        if (answerResponse) {
          twitchClient.client.say(channel, answerResponse);
        }
        break;
      }
      case '!endtrivia': {
        if (user.mod || isBroadcaster) {
          const endResponse = await endTrivia(twitchClient.client, channel, user);
          twitchClient.client.say(channel, endResponse);
        }
        break;
      }
      case '!shoutout':
      case '!so': {
        if (user.mod || isBroadcaster) {
          if (!args) {
            twitchClient.client.say(channel, 'Please specify a username to shoutout');
            break;
          }
<<<<<<< HEAD
          const shoutoutResponse = await handleShoutout(
            twitchClient.client,
            channel,
            args.split(' ')
          );
          twitchClient.client.say(channel, shoutoutResponse);
=======
          await handleShoutout(twitchClient, channel, user, args.split(' '));
>>>>>>> origin/master
        }
        break;
      }

      // Competitor analysis commands
      case '!track': {
        if (isBroadcaster) {
          const commands = competitorCommands(twitchClient.client, competitorAnalysis);
          await commands.trackChannel.execute(channel, user, message, args.split(' '));
        }
        break;
      }
      case '!untrack': {
        if (isBroadcaster) {
          const commands = competitorCommands(twitchClient.client, competitorAnalysis);
          await commands.untrackChannel.execute(channel, user, message, args.split(' '));
        }
        break;
      }
      case '!insights': {
        if (isBroadcaster) {
          const commands = competitorCommands(twitchClient.client, competitorAnalysis);
          await commands.insights.execute(channel, user, message, args.split(' '));
        }
        break;
      }
      case '!suggestions': {
        if (isBroadcaster) {
          const commands = competitorCommands(twitchClient.client, competitorAnalysis);
          await commands.suggestions.execute(channel, user, message, args.split(' '));
        }
        break;
      }
      case '!tracked': {
        if (isBroadcaster) {
          const commands = competitorCommands(twitchClient.client, competitorAnalysis);
          await commands.tracked.execute(channel, user, message, args.split(' '));
        }
        break;
      }
    }
  });

  // Handle new followers
  twitchClient.client.on('follow', async (channel, username) => {
    await streamAutomation.handleNewFollower(username);
  });

  // Handle raids
  twitchClient.client.on('raided', async (channel, username, viewers) => {
    // Assess raid quality
    const assessment = await assessRaid(username, viewers);
    if (assessment && assessment.action === 'block') {
      twitchClient.client.say(
        channel,
        `⚠️ Suspicious raid detected from ${username}. Risk level: ${assessment.risk}. ${assessment.reason}`
      );
      return;
    }

    // Welcome raiders if raid is safe
    const welcomeMessage = await handleRaid(username, viewers);
    twitchClient.client.say(channel, welcomeMessage);
  });

  // Setup intervals
<<<<<<< HEAD
  setInterval(() => {
    if (twitchClient.client) {
      processSongQueue();
    }
  }, 30000);
=======
  // Queue state is now handled by automatic sync in queue.js
>>>>>>> origin/master

  // Clean up analytics data periodically
  setInterval(
    () => {
      analytics.cleanup();
    },
    24 * 60 * 60 * 1000
  ); // Once per day

  // Update competitor analysis periodically
  setInterval(
    () => {
      competitorAnalysis.updateAllChannels();
    },
    60 * 60 * 1000
  ); // Once per hour

  // Handle stream end
  process.on('SIGINT', async () => {
    await streamEventHandlers.onStreamEnd();
    analytics.endStream();
    const finalAnalysis = await endAnalytics();
    if (finalAnalysis && twitchClient.client) {
      const channelName = process.env.TWITCH_CHANNEL;
<<<<<<< HEAD
      twitchClient.client.say(
        `#${channelName}`,
        'Stream ended! Check !insights for the final stream analysis. Key metrics:\n' +
          `• Health: ${finalAnalysis.health.status}\n` +
          `• Best Category: ${finalAnalysis.performance.bestCategory}\n` +
          `• Viewer Retention: ${finalAnalysis.performance.viewerRetention}%`
      );
=======
      const duration =
        streamCommands.uptime() === 'Stream is offline' ? '0h 0m' : streamCommands.uptime();
      const message = [
        'Stream ended! Final stream analysis:',
        `• Stream Health: ${finalAnalysis.health.status} (Score: ${finalAnalysis.health.score}/100)`,
        `• Stream Duration: ${duration}`,
        `• Bitrate: ${finalAnalysis.health.bitrate.average}kbps (${finalAnalysis.health.bitrate.stability})`,
        `• Peak Viewers: ${finalAnalysis.stats.peakViewers}`,
        `• Average Viewers: ${finalAnalysis.stats.averageViewers}`,
        `• Best Category: ${finalAnalysis.performance.bestCategory}`,
        `• Viewer Retention: ${finalAnalysis.performance.viewerRetention}%`,
        `• Engagement Rate: ${finalAnalysis.performance.averageEngagement}%`,
        `• Total Chat Messages: ${finalAnalysis.stats.totalMessages}`,
        `• Most Active Chatters: ${finalAnalysis.stats.activeViewers.join(', ')}`,
        '',
        'Top Suggestions:',
        ...finalAnalysis.performance.improvements.slice(0, 2).map((imp) => `• ${imp}`),
        '',
        'Check !insights for more detailed analytics!',
      ].join('\n');

      twitchClient.client.say(`#${channelName}`, message);
>>>>>>> origin/master
    }
    process.exit();
  });

  return twitchClient;
}

function handleChatInsights(client, channel) {
  const stats = chatInteraction.getStats();
  const insights = [
    `Chat Mood: ${stats.chatMood.current.sentiment} (Energy: ${stats.chatMood.current.energy})`,
    `Top Topics: ${stats.topTopics
      .slice(0, 3)
      .map((t) => `${t.topic}(${t.count})`)
      .join(', ')}`,
    `Most Active Hour: ${stats.activeHours[0]?.hour}:00`,
    `Total Interactions: ${stats.totalInteractions}`,
    `Chat Styles: ${Object.entries(stats.userStyles)
      .map(([style, count]) => `${style}(${count})`)
      .join(', ')}`,
  ].join(' | ');
  client.say(channel, `📊 ${insights}`);
}

export { initBot };
