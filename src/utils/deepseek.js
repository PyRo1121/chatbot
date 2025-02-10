import OpenAI from 'openai';
import logger from './logger.js';

const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

export async function generateResponse(prompt, command = '') {
  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'deepseek-chat',
      temperature: 0.7,
      max_tokens: 1000,
    });

    return completion.choices[0].message.content;
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
        neutral: 0,
      },
    };
  }

  if (!message || typeof message !== 'string') {
    logger.error('Invalid message provided for sentiment analysis');
    return null;
  }

  try {
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

    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'deepseek-chat',
      temperature: 0.2,
      max_tokens: 500,
    });

    const text = completion.choices[0].message.content.trim();

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
