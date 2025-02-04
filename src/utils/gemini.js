import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from './logger.js';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateResponse(prompt, systemPrompt = '') {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const combinedPrompt = `${systemPrompt}

${prompt}`;

    const result = await model.generateContent(combinedPrompt);
    const { response } = result;
    const text = response.text();

    logger.debug('Generated response from Gemini:', { text });

    return text;
  } catch (error) {
    logger.error('Error generating AI response:', error);
    return null;
  }
}

export async function analyzeSentiment(message) {
  if (!message || typeof message !== 'string') {
    logger.error('Invalid message provided for sentiment analysis');
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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

    // Validate and parse response
    try {
      const sentimentData = JSON.parse(text);

      // Validate response structure
      if (!isValidSentimentResponse(sentimentData)) {
        throw new Error('Invalid sentiment response structure');
      }

      logger.debug('Parsed sentiment response:', { sentimentData });
      return sentimentData;
    } catch (parseError) {
      logger.error('Failed to parse sentiment response:', { text, error: parseError });
      return null;
    }
  } catch (error) {
    logger.error('Error generating sentiment analysis:', error);
    return null;
  }
}

function isValidSentimentResponse(data) {
  return (
    typeof data === 'object' &&
    typeof data.toxicityScore === 'number' &&
    data.toxicityScore >= 0 &&
    data.toxicityScore <= 1 &&
    typeof data.flagged === 'boolean' &&
    typeof data.categories === 'object' &&
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
