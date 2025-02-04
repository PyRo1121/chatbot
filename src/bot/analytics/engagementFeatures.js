import { generateResponse } from '../../utils/gemini.js';
import logger from '../../utils/logger.js';

// Store stream events and highlights
const streamEvents = {
  events: [],
  highlights: [],
  clips: [],
  chatMood: {
    current: {
      sentiment: 'Neutral',
      energy: 'Normal',
      lastUpdate: new Date(),
    },
    history: [],
  },
};

// Add stream event
export function addStreamEvent(type, description) {
  streamEvents.events.push({
    type,
    description,
    timestamp: new Date(),
  });
}

// Add highlight moment
export function addHighlight(description, clipId = null) {
  streamEvents.highlights.push({
    description,
    clipId,
    timestamp: new Date(),
  });
}

// Update chat mood
export function updateChatMood(messages) {
  const now = new Date();

  // Store previous mood in history
  if (streamEvents.chatMood.current.lastUpdate) {
    streamEvents.chatMood.history.push({
      ...streamEvents.chatMood.current,
      endTime: now,
    });
  }

  // Generate new mood analysis
  analyzeChatMood(messages).then((mood) => {
    streamEvents.chatMood.current = {
      ...mood,
      lastUpdate: now,
    };
  });
}

// Analyze chat mood
async function analyzeChatMood(messages) {
  const prompt = `Analyze these recent chat messages and determine the overall mood and energy level: ${JSON.stringify(messages)}`;
  const systemPrompt =
    'You are a chat mood analyzer. Return a brief analysis with sentiment (Positive/Neutral/Negative) and energy level (High/Normal/Low).';

  const analysis = await generateResponse(prompt, systemPrompt);

  // Default values if analysis fails
  return {
    sentiment: 'Neutral',
    energy: 'Normal',
  };
}

// Generate stream recap
export async function generateRecap() {
  if (streamEvents.events.length === 0) {
    return 'No stream events recorded yet.';
  }

  const eventsSummary = streamEvents.events.map((event) => ({
    type: event.type,
    description: event.description,
    time: event.timestamp.toLocaleTimeString(),
  }));

  const prompt = `Create a brief, engaging summary of these stream events: ${JSON.stringify(eventsSummary)}`;
  const systemPrompt =
    'You are a stream recap generator. Create an engaging, concise summary of what has happened in the stream so far.';

  const recap = await generateResponse(prompt, systemPrompt);
  return recap || 'Unable to generate stream recap at this time.';
}

// Create highlight with AI title
export async function createHighlight(description, clipId = null) {
  const prompt = `Generate an engaging, clickable title for this stream highlight: ${description}`;
  const systemPrompt =
    'You are a highlight title generator. Create catchy, engaging titles that will attract viewers while accurately describing the content.';

  const title = await generateResponse(prompt, systemPrompt);

  if (title) {
    addHighlight(description, clipId);
    return {
      success: true,
      title,
      clipId,
    };
  }

  return {
    success: false,
    message: 'Failed to generate highlight title',
  };
}

// Get current chat vibe
export async function getChatVibe() {
  const currentMood = streamEvents.chatMood.current;
  const recentHistory = streamEvents.chatMood.history.slice(-3);

  const moodData = {
    current: currentMood,
    recent: recentHistory,
  };

  const prompt = `Analyze this chat mood data and provide an engaging summary of the current vibe: ${JSON.stringify(moodData)}`;
  const systemPrompt =
    'You are a chat vibe analyzer. Create a fun, engaging description of the current chat atmosphere.';

  const analysis = await generateResponse(prompt, systemPrompt);
  return (
    analysis ||
    `Chat is feeling ${currentMood.sentiment.toLowerCase()} with ${currentMood.energy.toLowerCase()} energy.`
  );
}

// Get all highlights
export function getHighlights() {
  return streamEvents.highlights;
}

// Reset stream events
export function resetStreamEvents() {
  streamEvents.events = [];
  streamEvents.highlights = [];
  streamEvents.clips = [];
  streamEvents.chatMood = {
    current: {
      sentiment: 'Neutral',
      energy: 'Normal',
      lastUpdate: new Date(),
    },
    history: [],
  };
}

export default {
  addStreamEvent,
  addHighlight,
  updateChatMood,
  generateRecap,
  createHighlight,
  getChatVibe,
  getHighlights,
  resetStreamEvents,
};
