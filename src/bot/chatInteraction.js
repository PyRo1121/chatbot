import { generateResponse } from '../utils/openai.js';
import viewerManager from './viewerManager.js';
import logger from '../utils/logger.js';

// Track viewer engagement
const viewerEngagement = new Map();

// Track chat context for each user
const chatContexts = new Map();

// Points system configuration
const POINTS_PER_MESSAGE = 1;
const BONUS_POINTS_FOR_ENGAGEMENT = 5;
const MIN_MESSAGES_FOR_BONUS = 3;

// Generate personalized response
async function generatePersonalizedResponse(username, message) {
  try {
    // Get user's chat context
    const context = chatContexts.get(username) || [];

    // Create system prompt
    const systemPrompt = `You are a Twitch chat bot assistant. The user ${username} has been chatting about: ${context.join(', ')}. Provide a fun, engaging response that encourages conversation.`;

    // Generate response
    const response = await generateResponse(message, systemPrompt);

    // Update chat context
    const newContext = [...context, message].slice(-5); // Keep last 5 messages
    chatContexts.set(username, newContext);

    return response;
  } catch (error) {
    logger.error('Error generating personalized response:', error);
    return null;
  }
}

// Handle chat message
async function handleChatMessage(username, message) {
  try {
    // Update engagement tracking
    const engagement = viewerEngagement.get(username) || {
      messageCount: 0,
      lastMessageTime: Date.now(),
    };
    engagement.messageCount++;
    engagement.lastMessageTime = Date.now();
    viewerEngagement.set(username, engagement);

    // Award points
    await viewerManager.addPoints(username, POINTS_PER_MESSAGE);

    // Check for engagement bonus
    if (engagement.messageCount % MIN_MESSAGES_FOR_BONUS === 0) {
      await viewerManager.addPoints(username, BONUS_POINTS_FOR_ENGAGEMENT);
      return `@${username} You've been super active in chat! +${BONUS_POINTS_FOR_ENGAGEMENT} bonus points!`;
    }

    // Generate personalized response for every 3rd message
    if (engagement.messageCount % 3 === 0) {
      const response = await generatePersonalizedResponse(username, message);
      if (response) {
        return `@${username} ${response}`;
      }
    }

    return null;
  } catch (error) {
    logger.error('Error handling chat message:', error);
    return null;
  }
}

// Get viewer engagement stats
async function getEngagementStats(username) {
  const engagement = viewerEngagement.get(username);
  if (!engagement) {
    return null;
  }

  return {
    messageCount: engagement.messageCount,
    lastActive: new Date(engagement.lastMessageTime).toLocaleTimeString(),
    pointsEarned:
      engagement.messageCount * POINTS_PER_MESSAGE +
      Math.floor(engagement.messageCount / MIN_MESSAGES_FOR_BONUS) * BONUS_POINTS_FOR_ENGAGEMENT,
  };
}

// Add interactive commands
const chatCommands = {
  '!points': async (username) => {
    const stats = await getEngagementStats(username);
    if (!stats) {
      const wittyResponse = await getWittyResponse(username);
      return `@${username} ${wittyResponse} But you haven't chatted yet! Start chatting to earn points!`;
    }
    const wittyResponse = await getWittyResponse(username);
    return `@${username} ${wittyResponse} You've sent ${stats.messageCount} messages and earned ${stats.pointsEarned} points! Keep it up!`;
  },
  '!lastactive': async (username) => {
    const stats = await getEngagementStats(username);
    if (!stats) {
      const wittyResponse = await getWittyResponse(username);
      return `@${username} ${wittyResponse} But you haven't chatted yet!`;
    }
    const wittyResponse = await getWittyResponse(username);
    return `@${username} ${wittyResponse} You were last active at ${stats.lastActive}. Don't be a stranger!`;
  },
  '!chatstats': async (username) => {
    const stats = await getEngagementStats(username);
    if (!stats) {
      const wittyResponse = await getWittyResponse(username);
      return `@${username} ${wittyResponse} But you haven't chatted yet!`;
    }
    const wittyResponse = await getWittyResponse(username);
    return `@${username} ${wittyResponse} Chat stats: ${stats.messageCount} messages, ${stats.pointsEarned} points, last active ${stats.lastActive}. You're on fire!`;
  },
};

// Generate a witty response
async function getWittyResponse(username) {
  const prompts = [
    `Create a funny response for ${username}`,
    `Generate a witty comeback for ${username}`,
    `Make a humorous remark for ${username}`,
  ];
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  return generateResponse('', prompt);
}

// Backward compatibility wrapper
async function getStats(username) {
  return getEngagementStats(username);
}

export default {
  handleChatMessage,
  getEngagementStats,
  getStats,
  getWittyResponse,
  chatCommands,
};
