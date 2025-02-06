import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from './logger.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateResponse(prompt, command = '') {
  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-pro',
      // Modify safety settings to be less restrictive but still acceptable
      safetySettings: command === '!roast' ? [
        {
          category: 'HARASSMENT',
          threshold: 'BLOCK_ONLY_HIGH'
        },
        {
          category: 'HATE_SPEECH',
          threshold: 'BLOCK_ONLY_HIGH'
        },
        {
          category: 'DANGEROUS_CONTENT',
          threshold: 'BLOCK_ONLY_HIGH'
        }
      ] : undefined
    });

    // For roasts, add a safety disclaimer
    const finalPrompt = command === '!roast' 
      ? `[Content Warning: Comedy Roast Content]\n${prompt}\n[Keep content appropriate for streaming]`
      : prompt;

    const result = await model.generateContent(finalPrompt);
    return result.response.text();
  } catch (error) {
    logger.error('Error generating AI response:', error);
    return null;
  }
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
        neutral: 0
      }
    };
  }

  if (!message || typeof message !== 'string') {
    logger.error('Invalid message provided for sentiment analysis');
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' });
    const prompt = `Analyze this message for toxicity and emotions.
Response requirements:
- Respond with ONLY a valid JSON object
- Do not include markdown formatting or backticks
- Use exact structure shown below:
{
  "toxicityScore": <number between 0-1>,
  "flagged": <boolean>,
  "categories": {
    "anger": <number between 0-1>,
    "sadness": <number between 0-1>,
    "joy": <number between 0-1>,
    "fear": <number between 0-1>,
    "neutral": <number between 0-1>
  }
}

Message to analyze: "${message}"`;

    const result = await model.generateContent(prompt);
    const { response } = result;
    const text = response.text().trim();

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

function isValidSentimentResponse(data) {
  return (
    data &&
    typeof data.toxicityScore === 'number' &&
    data.toxicityScore >= 0 &&
    data.toxicityScore <= 1 &&
    typeof data.flagged === 'boolean' &&
    data.categories &&
    ['anger', 'sadness', 'joy', 'fear', 'neutral'].every(
      category =>
        typeof data.categories[category] === 'number' &&
        data.categories[category] >= 0 &&
        data.categories[category] <= 1
    )
  );
}

export default {
  generateResponse,
  analyzeSentiment
};