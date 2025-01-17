import OpenAI from 'openai';
import 'dotenv/config';
import logger from './utils/logger.js';

// Initialize OpenAI client
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY.trim()
});

// Generate AI response
export async function generateResponse(prompt, systemPrompt = "You are a helpful assistant.") {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    logger.error('Error generating AI response:', error);
    return null;
  }
}

export default openai;
