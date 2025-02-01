import { generateResponse } from '../../utils/perplexity.js';
import logger from '../../utils/logger.js';

// Store community data
const communityData = {
  shoutouts: {
    history: [],
    effectiveness: {},
  },
  raids: {
    incoming: [],
    outgoing: [],
    suggestions: [],
  },
  collaborations: {
    history: [],
    active: [],
    potential: [],
  },
  networking: {
    connections: {},
    interactions: [],
    metrics: {},
  },
};

// Enhanced shoutout generation
export async function generateEnhancedShoutout(username, channelInfo) {
  const shoutoutData = {
    username,
    channelInfo,
    previousShoutouts: communityData.shoutouts.history.filter((so) => so.username === username),
    effectiveness: communityData.shoutouts.effectiveness[username],
  };

  const prompt = `Generate an engaging, personalized shoutout for streamer ${username}. Channel info: ${JSON.stringify(channelInfo)}`;
  const systemPrompt =
    "You are a community engagement assistant. Create warm, engaging shoutouts that highlight streamers' achievements and content while encouraging viewers to check them out.";

  const shoutout = await generateResponse(prompt, systemPrompt);

  // Track shoutout
  communityData.shoutouts.history.push({
    username,
    message: shoutout,
    timestamp: new Date(),
  });

  return shoutout || `Check out @${username}! They're awesome!`;
}

// Get raid suggestions
export async function getRaidSuggestions(currentCategory, viewerCount) {
  // Prepare raid data for analysis
  const raidData = {
    currentCategory,
    viewerCount,
    recentRaids: communityData.raids.outgoing.slice(-5),
    successfulRaids: communityData.raids.outgoing.filter((raid) => raid.retention > 0.5),
  };

  const prompt = `Suggest optimal raid targets based on this data: ${JSON.stringify(raidData)}. Consider category alignment, viewer count compatibility, and past raid success.`;
  const systemPrompt =
    'You are a raid optimization assistant. Suggest raid targets that would create meaningful community connections and benefit both channels.';

  const suggestions = await generateResponse(prompt, systemPrompt);
  return suggestions || 'Unable to generate raid suggestions at this time.';
}

// Find collaboration partners
export async function findCollaborationPartners(channelInfo) {
  const collabData = {
    channelInfo,
    activeCollabs: communityData.collaborations.active,
    pastCollabs: communityData.collaborations.history,
    potentialPartners: communityData.collaborations.potential,
  };

  const prompt = `Suggest potential collaboration partners based on this channel data: ${JSON.stringify(collabData)}. Consider content alignment, audience overlap, and growth opportunities.`;
  const systemPrompt =
    'You are a collaboration matchmaking assistant. Suggest partners that would create engaging content and mutual growth opportunities.';

  const suggestions = await generateResponse(prompt, systemPrompt);
  return suggestions || 'Unable to find collaboration suggestions at this time.';
}

// Track networking effectiveness
export async function getNetworkingEffectiveness() {
  const networkData = {
    connections: communityData.networking.connections,
    recentInteractions: communityData.networking.interactions.slice(-10),
    metrics: communityData.networking.metrics,
  };

  const prompt = `Analyze these networking metrics and provide insights: ${JSON.stringify(networkData)}. Focus on interaction quality, growth impact, and community building success.`;
  const systemPrompt =
    'You are a networking analytics assistant. Provide actionable insights about networking effectiveness and suggest improvements.';

  const analysis = await generateResponse(prompt, systemPrompt);
  return analysis || 'Unable to analyze networking effectiveness at this time.';
}

// Track incoming raid
export function trackIncomingRaid(raider, viewerCount) {
  communityData.raids.incoming.push({
    username: raider,
    viewers: viewerCount,
    timestamp: new Date(),
  });

  // Update networking metrics
  updateNetworkingMetrics(raider, 'incoming_raid', viewerCount);
}

// Track outgoing raid
export function trackOutgoingRaid(target, viewerCount, retention) {
  communityData.raids.outgoing.push({
    username: target,
    viewers: viewerCount,
    retention,
    timestamp: new Date(),
  });

  // Update networking metrics
  updateNetworkingMetrics(target, 'outgoing_raid', viewerCount);
}

// Track collaboration
export function trackCollaboration(partner, type, metrics) {
  communityData.collaborations.history.push({
    partner,
    type,
    metrics,
    timestamp: new Date(),
  });

  // Update networking metrics
  updateNetworkingMetrics(partner, 'collaboration', metrics);
}

// Update networking metrics
function updateNetworkingMetrics(username, interactionType, value) {
  if (!communityData.networking.connections[username]) {
    communityData.networking.connections[username] = {
      interactions: 0,
      lastInteraction: null,
      metrics: {},
    };
  }

  const connection = communityData.networking.connections[username];
  connection.interactions++;
  connection.lastInteraction = new Date();

  if (!connection.metrics[interactionType]) {
    connection.metrics[interactionType] = [];
  }
  connection.metrics[interactionType].push({
    value,
    timestamp: new Date(),
  });

  // Track interaction
  communityData.networking.interactions.push({
    username,
    type: interactionType,
    value,
    timestamp: new Date(),
  });
}

// Reset community data
export function resetCommunityData() {
  communityData.shoutouts = {
    history: [],
    effectiveness: {},
  };
  communityData.raids = {
    incoming: [],
    outgoing: [],
    suggestions: [],
  };
  communityData.collaborations = {
    history: [],
    active: [],
    potential: [],
  };
  communityData.networking = {
    connections: {},
    interactions: [],
    metrics: {},
  };
}

export default {
  generateEnhancedShoutout,
  getRaidSuggestions,
  findCollaborationPartners,
  getNetworkingEffectiveness,
  trackIncomingRaid,
  trackOutgoingRaid,
  trackCollaboration,
  resetCommunityData,
};
