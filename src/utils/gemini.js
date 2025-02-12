import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import logger from './logger.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateResponse(prompt, command = '') {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    logger.error('Error generating AI response:', error);
    return null;
  }
  return '🔥 Roast generator malfunction - try again!';
}

export async function analyzeSentiment(message, command = '') {
  // Skip moderation for roast command
  if (command === '!roast') {
    return {
      toxicityScore: 0,
      flagged: false,
      categories: {
        anger: 0,
        sadness: 0,
        joy: 0,
        fear: 0,
        neutral: 0,
      },
    };
  }

  if (!message || typeof message !== 'string') {
    logger.error('Invalid message provided for sentiment analysis');
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const prompt = `Analyze this message for toxicity and emotions and respond with ONLY raw JSON (no markdown, no backticks).
Example response:
{"toxicityScore":0.5,"flagged":false,"categories":{"anger":0,"sadness":0,"joy":0,"fear":0,"neutral":0}}

Message to analyze: "${message}"`;

    const result = await model.generateContent(prompt);
    const { response } = result;
    const text = response
      .text()
      .trim()
      .replace(/```json\n?|\n?```/g, '') // Remove any markdown formatting
      .replace(/\n/g, ''); // Remove newlines

    try {
      const sentimentData = JSON.parse(text);
      if (!isValidSentimentResponse(sentimentData)) {
        throw new Error('Invalid sentiment response structure');
      }
      return sentimentData;
    } catch (error) {
      logger.error('Error parsing sentiment response:', error);
      return null;
    }
  } catch (error) {
    logger.error('Error analyzing sentiment:', error);
    return null;
  }
}

function generateFallbackRoast(prompt) {
  return `🔥 ${prompt.replace('@', '')}, you're so basic, even AI can't roast you! 🤖`;
}

function isValidSentimentResponse(data) {
  return (
    data &&
    typeof data.toxicityScore === 'number' &&
    data.toxicityScore >= 0 &&
    data.toxicityScore <= 1 &&
    typeof data.flagged === 'boolean' &&
    data.categories &&
    ['anger', 'sadness', 'joy', 'fear', 'neutral'].every(
      (category) =>
        typeof data.categories[category] === 'number' &&
        data.categories[category] >= 0 &&
        data.categories[category] <= 1
    )
  );
}

export default {
  generateResponse,
  analyzeSentiment,
};
