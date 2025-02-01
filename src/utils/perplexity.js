import { perplexity } from '@ai-sdk/perplexity';
import { generateText } from 'ai';
import 'dotenv/config';
import logger from './logger.js';

if (!process.env.PERPLEXITY_API_KEY) {
  throw new Error('PERPLEXITY_API_KEY environment variable is required');
}

// Initialize Perplexity model
const model = perplexity('sonar');

// Generate AI response using Perplexity Sonar
export async function generateResponse(prompt, systemPrompt = 'You are a witty assistant.') {
  try {
    const { text } = await generateText({
      model,
      messages: [
        {
          role: 'system',
          content: `${systemPrompt} Important: NEVER include citation numbers like [1], [2], etc. in your responses.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.9,
      maxTokens: 500,
      num_searches: 1,
    });

    // Remove any remaining citation numbers if they somehow got through
    return text.replace(/\[\d+\]/g, '').trim();
  } catch (error) {
    logger.error('Error generating AI response:', error);
    return null;
  }
}

// Analyze message sentiment
export async function analyzeSentiment(message) {
  try {
    const { text } = await generateText({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a content moderator. You must respond with a valid JSON object containing toxicity analysis. The response must be parseable by JSON.parse(). Do not include citation numbers.',
        },
        {
          role: 'user',
          content: `Analyze this message for toxicity. Respond with ONLY a raw JSON object (no markdown, no backticks) with this exact structure: {"toxicityScore": <number 0-1>, "flagged": <boolean>, "categories": <object>}. Message: ${message}`,
        },
      ],
      temperature: 0.1, // Lower temperature for more consistent JSON output
      maxTokens: 100,
      num_searches: 1,
    });

    try {
      // Try to parse the response as JSON
      const analysis = JSON.parse(text.trim());

      // Validate the response structure
      if (typeof analysis.toxicityScore !== 'number' || typeof analysis.flagged !== 'boolean') {
        throw new Error('Invalid response structure');
      }

      return {
        toxicityScore: analysis.toxicityScore,
        flagged: analysis.flagged,
        categories: analysis.categories || {},
      };
    } catch (parseError) {
      logger.error('Error parsing sentiment response:', parseError);
      // Fallback to default values if parsing fails
      return {
        toxicityScore: 0,
        flagged: false,
        categories: {},
      };
    }
  } catch (error) {
    logger.error('Error analyzing sentiment:', error);
    return {
      toxicityScore: 0,
      flagged: false,
      categories: {},
    };
  }
}

export default {
  generateResponse,
  analyzeSentiment,
};
