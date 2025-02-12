import { generateResponse, analyzeSentiment } from './gemini.js';
import logger from './logger.js';
import NodeCache from 'node-cache';

// Initialize cache with 5 minute TTL
const responseCache = new NodeCache({ stdTTL: 300 });

// Configurable prompt sections
const PROMPT_SECTIONS = {
  role: 'You are a knowledgeable and engaging Twitch chat bot.',
  rules: [
    'Use actual game names and real details',
    'Never use placeholders',
    'Admit knowledge gaps directly',
    'Keep responses concise and chat-friendly',
  ],
  topics: ['Games', 'Sports', 'Tech', 'News', 'Entertainment'],
  style: [
    'Friendly but focused',
    'Natural conversation',
    'Appropriate humor',
    'Current and relevant',
  ],
};

// Build dynamic system prompt
const DEFAULT_SYSTEM_PROMPT = `
${PROMPT_SECTIONS.role}

Rules:
${PROMPT_SECTIONS.rules.map((rule) => `- ${rule}`).join('\n')}

Topics:
${PROMPT_SECTIONS.topics.map((topic) => `- ${topic}`).join('\n')}

Style:
${PROMPT_SECTIONS.style.map((style) => `- ${style}`).join('\n')}`;

// Enhanced response generation with caching
async function enhancedGenerateResponse(prompt, systemPrompt = DEFAULT_SYSTEM_PROMPT) {
  const cacheKey = `${systemPrompt}:${prompt}`;

  try {
    // Check cache first
    const cached = responseCache.get(cacheKey);
    if (cached) {
      logger.debug('Cache hit for prompt');
      return cached;
    }

    // Generate new response with timeout
    const response = await Promise.race([
      generateResponse(prompt, systemPrompt),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Response timeout')), 10000)),
    ]);

    // Cache successful response
    if (response) {
      responseCache.set(cacheKey, response);
    }

    return response;
  } catch (error) {
    logger.error('AI response generation failed:', error);
    return null;
  }
}

// Enhanced sentiment analysis with validation
async function enhancedAnalyzeSentiment(text) {
  try {
    const result = await analyzeSentiment(text);
    
    // Validate the sentiment analysis result
    if (!result || typeof result !== 'object') {
      throw new Error('Invalid sentiment result format');
    }

    // Add additional validation if needed
    if (result.sentiment < -1 || result.sentiment > 1) {
      result.sentiment = Math.max(-1, Math.min(1, result.sentiment));
    }

    if (result.toxicity < 0 || result.toxicity > 1) {
      result.toxicity = Math.max(0, Math.min(1, result.toxicity));
    }

    return result;
  } catch (error) {
    logger.error('Sentiment analysis failed:', error);
    // Return a neutral default response instead of throwing
    return {
      sentiment: 0,
      toxicity: 0,
      tone: 'neutral',
      flags: []
    };
  }
}

// Validate sentiment response
function isValidSentiment(sentiment) {
  return (
    sentiment &&
    typeof sentiment.toxicityScore === 'number' &&
    typeof sentiment.flagged === 'boolean' &&
    sentiment.categories &&
    typeof sentiment.categories === 'object'
  );
}

export {
  enhancedGenerateResponse as generateResponse,
  enhancedAnalyzeSentiment as analyzeSentiment,
  DEFAULT_SYSTEM_PROMPT,
  PROMPT_SECTIONS,
};

export default {
  generateResponse: enhancedGenerateResponse,
  analyzeSentiment: enhancedAnalyzeSentiment,
};
