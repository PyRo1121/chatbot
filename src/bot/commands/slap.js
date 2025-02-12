import { generateResponse } from '../../utils/gemini.js';
import logger from '../../utils/logger.js';

function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    throw new Error('Invalid username');
  }
  return username.replace(/^@+/, '').trim();
}

function getSlapPower() {
  // 12% chance for 100% power
  if (Math.random() < 0.12) {
    return 100;
  }
  // Otherwise random between 1-99
  return Math.floor(Math.random() * 99) + 1;
}

function createSlapPrompt(sender, target, power) {
  let intensity = 'weak';
  if (power === 100) {
    intensity = 'knockout';
  } else if (power >= 80) {
    intensity = 'very strong';
  } else if (power >= 60) {
    intensity = 'strong';
  } else if (power >= 40) {
    intensity = 'moderate';
  } else if (power >= 20) {
    intensity = 'weak';
  } else {
    intensity = 'pathetic';
  }

  return `Generate a Twitch chat message describing a slap between users.

Context:
- Sender: ${sender}
- Target: ${target}
- Power Level: ${power}%
- Intensity: ${intensity}
${power === 100 ? '- This is a knockout hit!' : ''}

Rules:
1. Write ONE natural message (100-150 chars)
2. Use 2 appropriate emojis (👋 💥 😱 🤯 💫 ⚡ 🌟 😆 etc)
3. Include the power percentage
4. Make it ${intensity} in intensity
5. Be creative and funny
${power === 100 ? '6. Make it dramatically over-the-top' : ''}

Style Guide:
- Keep it playful and entertaining
- Use Twitch-appropriate humor
- Include fighting game / WWE references for strong hits
- Use creative descriptions of impact
- Keep it family-friendly despite the violence

DO NOT:
- Be actually violent or cruel
- Use placeholder text
- Make it sound robotic`;
}

export async function handleSlap(channel, user, args) {
  if (!args || args.length === 0) {
    return 'Please specify who you want to slap!';
  }

  let targetUser;
  try {
    targetUser = validateUsername(args[0]);
  } catch (error) {
    return 'Invalid username provided';
  }

  // Prevent self-slaps
  if (targetUser.toLowerCase() === user.username.toLowerCase()) {
    return `${user.username}, you can't slap yourself! Try slapping someone else! 👋`;
  }

  try {
    const power = getSlapPower();
    const prompt = createSlapPrompt(user.username, targetUser, power);
    const response = await generateResponse(prompt);

    if (!response || typeof response !== 'string' || response.length < 20) {
      logger.warn('Invalid AI response for slap command:', { response });
      return `${user.username} slaps ${targetUser} with ${power}% power! 👋`;
    }

    // Clean and format the response
    let cleanResponse = response
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^["']|["']$/g, '')
      .trim();

    // Ensure message isn't too long
    if (cleanResponse.length > 150) {
      cleanResponse = `${cleanResponse.substring(0, 147)}...`;
    }

    // Add emojis if not enough present
    const emojiCount = (cleanResponse.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
    if (emojiCount < 2) {
      const emojis = ['👋', '💥', '😱', '🤯', '💫', '⚡', '🌟', '😆'];
      while ((cleanResponse.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length < 2) {
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        cleanResponse += ` ${emoji}`;
      }
    }

    // Ensure power percentage is included
    if (!cleanResponse.includes(`${power}%`)) {
      cleanResponse += ` (${power}% power)`;
    }

    return cleanResponse;
  } catch (error) {
    logger.error('Error generating slap message:', error);
    return `${user.username} slaps ${targetUser} with ${power}% power! 👋`;
  }
}
