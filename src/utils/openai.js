import OpenAI from 'openai';
import 'dotenv/config';
import logger from './logger.js';
import fetch from 'node-fetch';
import { FormData } from 'formdata-node';
import { Blob } from 'buffer';

// Initialize OpenAI client
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY.trim(),
});

// Generate AI response
export async function generateResponse(
  prompt,
  systemPrompt = 'You are a helpful assistant.'
) {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
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

// Analyze audio from URL
export async function analyzeAudioFromUrl(url) {
  try {
    // Download the audio file
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }
    const audioBuffer = await response.arrayBuffer();

    // Create FormData with audio buffer
    const formData = new FormData();
    const blob = new Blob([Buffer.from(audioBuffer)], { type: 'audio/mpeg' });
    formData.append('file', blob, 'preview.mp3');
    formData.append('model', 'whisper-1');

    // Transcribe the audio
    const transcript = await openai.audio.transcriptions.create(formData);

    // Analyze the transcription
    const analysis = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            'You are an audio content analyzer. ONLY check for two specific things: 1) Explicitly racist content (NOT regular rap lyrics or mentions of race), and 2) If this is a troll/meme song (like Rick Roll). DO allow all rap music, explicit content, and songs about violence/drugs/adult themes. This is for an 18+ stream.',
        },
        {
          role: 'user',
          content: `Analyze this transcription ONLY for explicit racism or if it's a troll song. Allow all rap music and adult content: "${transcript.text}"`,
        },
      ],
      max_tokens: 100,
      temperature: 0.7,
    });

    return {
      transcript: transcript.text,
      analysis: analysis.choices[0].message.content,
      isAppropriate:
        !analysis.choices[0].message.content
          .toLowerCase()
          .includes('inappropriate') &&
        !analysis.choices[0].message.content.toLowerCase().includes('troll') &&
        !analysis.choices[0].message.content.toLowerCase().includes('meme'),
    };
  } catch (error) {
    logger.error('Error analyzing audio:', error);
    return {
      error: true,
      message: error.message,
    };
  }
}

// Analyze message toxicity using OpenAI moderation
export async function analyzeSentiment(message) {
  try {
    const moderation = await openai.moderations.create({
      input: message,
    });

    const results = moderation.results[0];
    return {
      toxicityScore: results.category_scores.toxicity,
      flagged: results.flagged,
      categories: results.categories,
    };
  } catch (error) {
    logger.error('Error analyzing sentiment:', error);
    return {
      toxicityScore: 0,
      flagged: false,
      categories: {},
    };
  }
}

export default openai;
