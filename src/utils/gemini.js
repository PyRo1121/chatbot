import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import logger from './logger.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

export async function generateResponse(prompt, context = {}) {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        logger.error('Error generating AI response:', error);
        return null;
    }
}

// For backwards compatibility
export const generateAIResponse = generateResponse;

// Keep ONLY this implementation of analyzeSentiment
export async function analyzeSentiment(message, command = '') {
  // Skip moderation for roast command
  if (command === '!roast') {
    return {
      sentiment: 0,
      toxicity: 0,
      tone: 'neutral',
      flags: [],
    };
  }

  if (!message || typeof message !== 'string') {
    logger.error('Invalid message provided for sentiment analysis');
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Analyze this message for sentiment and toxicity. Return ONLY raw JSON (no markdown, no backticks) with this structure:
{
  "sentiment": (number between -1 and 1),
  "toxicity": (number between 0 and 1),
  "tone": (string: "positive", "neutral", or "negative"),
  "flags": (array of strings for any concerns)
}

Message to analyze: "${message}"`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text().trim();

    // Extract just the JSON portion from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response');
    }

    // Parse the extracted JSON
    const analysisResult = JSON.parse(jsonMatch[0]);

    // Validate the required fields
    if (typeof analysisResult.sentiment !== 'number' ||
        typeof analysisResult.toxicity !== 'number' ||
        !analysisResult.tone ||
        !Array.isArray(analysisResult.flags)) {
      throw new Error('Invalid response format');
    }

    // Ensure values are within bounds
    analysisResult.sentiment = Math.max(-1, Math.min(1, analysisResult.sentiment));
    analysisResult.toxicity = Math.max(0, Math.min(1, analysisResult.toxicity));

    return analysisResult;
  } catch (error) {
    logger.error('Error analyzing sentiment:', error);
    // Return neutral sentiment on error
    return {
      sentiment: 0,
      toxicity: 0,
      tone: 'neutral',
      flags: [],
    };
  }
}

export function generateFallbackRoast(prompt) {
  return `🔥 ${prompt.replace('@', '')} you're so basic, even AI can't roast you! 🤖`;
}

// Export the functions
export default {
  generateResponse,
  generateAIResponse,
  analyzeSentiment,
  generateFallbackRoast,
};
