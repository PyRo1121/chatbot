import { generateResponse } from '../../utils/perplexity.js';

// Track last roast time for each user
const userCooldowns = new Map();
const COOLDOWN_TIME = 60000; // 60 seconds in milliseconds

const cooldownResponses = [
  'Whoa there Satan, let the last burn heal first! 🔥',
  'Easy tiger, your roasting privileges are on timeout! ⏰',
  'Sorry chief, the roast oven needs a minute to reheat! 🍖',
  'Calm down Gordon Ramsay, one roast at a time! 👨‍🍳',
  'Your roast meter is on cooldown! Try touching grass for 60 seconds 🌱',
  'Roasting on cooldown - try writing these bangers in your diary instead! 📝',
  'Hold up! The fire department asked for a 60-second break! 🚒',
  'Error 420: Too much fire detected. Please wait! 🔥',
  'Sheesh, save some violence for the rest of us! Come back in a minute! ⚔️',
  'Your roast game is too powerful - forced 60s nerf applied! 💪',
];

export async function handleRoast(twitchClient, channel, targetUser) {
  if (!targetUser) {
    return {
      success: false,
      message: 'Usage: !roast @username',
    };
  }

  const now = Date.now();
  const lastRoastTime = userCooldowns.get(targetUser.toLowerCase());

  if (lastRoastTime && now - lastRoastTime < COOLDOWN_TIME) {
    const remainingTime = Math.ceil((COOLDOWN_TIME - (now - lastRoastTime)) / 1000);
    const randomResponse = cooldownResponses[Math.floor(Math.random() * cooldownResponses.length)];
    return {
      success: false,
      message: `${randomResponse} (${remainingTime}s remaining)`,
    };
  }

  try {
    const systemPrompt =
      'You are a brutal roast master. Keep roasts under 500 characters and use simple, everyday words - no fancy vocabulary or complex language. Make savage, personal roasts about life choices, personality flaws, and embarrassing behaviors. DO NOT mention anything about gaming, streaming skills, or gameplay. Focus on brutal personal insults using basic, clear language. This is an 18+ stream so adult themes are fine, but stay within Twitch TOS';
    const userPrompt = `Generate a savage roast for Twitch user ${targetUser}. No gaming references, keep it personal.`;

    const response = await generateResponse(userPrompt, systemPrompt);
    if (!response) {
      return {
        success: false,
        message: `Failed to roast ${targetUser}. Try again later.`,
      };
    }

    // Update cooldown timer after successful roast
    userCooldowns.set(targetUser.toLowerCase(), now);

    return {
      success: true,
      message: `@${targetUser} ${response}`,
    };
  } catch {
    return {
      success: false,
      message: `Failed to roast ${targetUser}. Try again later.`,
    };
  }
}
