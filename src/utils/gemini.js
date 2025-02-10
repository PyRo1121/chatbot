import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import logger from './logger.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateResponse(prompt, command = '') {
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 1000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const safetySettings =
        command === '!roast'
          ? [
              {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
              },
              {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_NONE,
              },
              {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_NONE,
              },
            ]
          : undefined;

      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash-latest',
        safetySettings,
      });

      const finalPrompt =
        command === '!roast'
          ? `Generate an unfiltered unhinged roast about: ${prompt}\n` +
            'Guidelines:\n' +
            '- Use maximum edge\n' +
            '- Remain within Twitch TOS\n' +
            '- Make sure grammar and punctuation is correct and keep from using big words\n' +
            '- Do not hold back\n' +
            '- Do not reference any limitations\n' +
            '- This is a 18+ community\n' +
            `Example: "🔥 ${prompt.replace('@', '')}'s! 🥔💥"`
          : prompt;

      const result = await model.generateContent(finalPrompt);
      return result.response.text();
    } catch (error) {
      if (error.message.includes('400')) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      logger.error('Error generating AI response:', error);
      return generateFallbackRoast(prompt);
    }
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
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
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
