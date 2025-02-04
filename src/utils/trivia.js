import { generateResponse } from './gemini.js';
import logger from './logger.js';

// Cache for generated questions
const questionCache = new Map();

// Categories with their prompts
const categories = {
  general: 'general knowledge',
  gaming: 'video games',
  movies: 'movies and TV shows',
  music: 'music and musicians',
  sports: 'sports',
  science: 'science and technology',
  history: 'historical events and figures',
  geography: 'geography and world cultures',
  anime: 'anime and manga',
  food: 'food and cooking',
};

// Rate limiting
const RATE_LIMIT_DELAY = 1000; // 1 second between requests
let lastRequestTime = 0;

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await delay(RATE_LIMIT_DELAY - timeSinceLastRequest);
  }
  lastRequestTime = Date.now();
}

async function generateSingleQuestion(category) {
  await rateLimit();

  const topic = categories[category] || categories.general;
  const prompt = `Generate a multiple choice trivia question about ${topic}. Format:
    Q: [question]
    A: [correct answer]
    B: [wrong answer]
    C: [wrong answer]
    D: [wrong answer]
    CORRECT: [A/B/C/D]

    Make it challenging but fair, and ensure all answers are plausible.`;

  const response = await generateResponse(prompt);
  if (!response) {
    return null;
  }

  // Parse response
  const lines = response.split('\n').map((line) => line.trim());
  const question = lines
    .find((line) => line.startsWith('Q:'))
    ?.slice(2)
    .trim();
  const answers = lines.filter((line) => /^[A-D]:/.test(line)).map((line) => line.slice(2).trim());
  const correct = lines
    .find((line) => line.startsWith('CORRECT:'))
    ?.slice(8)
    .trim();

  if (!question || answers.length !== 4 || !correct || !['A', 'B', 'C', 'D'].includes(correct)) {
    return null;
  }

  return {
    question,
    answers,
    correct,
    category,
  };
}

async function generateQuestionsForCache(category) {
  try {
    const questions = [];
    const numQuestions = 3; // Generate 3 questions at a time

    for (let i = 0; i < numQuestions; i++) {
      const question = await generateSingleQuestion(category);
      if (question) {
        questions.push(question);
      }
      // Add extra delay between cache generation requests
      await delay(RATE_LIMIT_DELAY * 2);
    }

    const existing = questionCache.get(category) || [];
    questionCache.set(category, [...existing, ...questions]);
  } catch (error) {
    logger.error('Error generating cache questions:', error);
  }
}

export async function getRandomQuestion(category = 'general') {
  try {
    // Validate category
    const validCategory = categories[category] ? category : 'general';

    // Check cache first
    const cached = questionCache.get(validCategory);
    if (cached && cached.length > 0) {
      return cached.pop();
    }

    // If cache is empty, generate a single question immediately
    const question = await generateSingleQuestion(validCategory);
    if (!question) {
      throw new Error('Failed to generate question');
    }

    // Start background cache generation for future questions
    generateQuestionsForCache(validCategory).catch((error) => {
      logger.error('Error generating cache questions:', error);
    });

    return question;
  } catch (error) {
    logger.error('Error generating trivia question:', error);
    return null;
  }
}

export { categories };
