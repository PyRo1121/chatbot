import { generateResponse } from '../../utils/gemini.js';
import logger from '../../utils/logger.js';

function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    throw new Error('Invalid username');
  }
  return username.replace(/^@+/, '').trim();
}

function getFallbackMessage(sender, target) {
  const messages = [
    `${sender} wraps ${target} in the warmest, coziest virtual hug! 🤗 ✨`,
    `${sender} sends ${target} a big fluffy cloud of hugs and good vibes! 💝 ✨`,
    `${sender} gives ${target} a gentle, heartwarming hug filled with friendship! 🫂 ❤️`,
    `${sender} surrounds ${target} with a magical bubble of hugs and happiness! 🤗 💫`,
    `${sender} shares a special friendship hug with ${target}! 💝 ✨`
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

function createHugPrompt(sender, target) {
  return `Generate a Twitch chat message describing a heartwarming hug between users.

Context:
- Sender: ${sender}
- Recipient: ${target}

Rules:
1. Write ONE natural message (100-150 chars)
2. Use 2 emojis (🤗 💝 🫂 ❤️ ✨ 💫)
3. Be warm, friendly, and sweet
4. Include sender's name at start
5. Format as: "[sender]: [description of hug with target]"
6. Make it feel personal and caring
7. Keep it wholesome and family-friendly

Style Guide:
- Use gentle, warm words (soft, warm, cozy, sweet, gentle)
- Add personality (magical, sparkly, friendly, caring)
- Make it feel like a real moment between friends

DO NOT:
- Be overly dramatic or formal
- Use placeholder text
- Make it sound robotic`;
}

export async function handleHug(channel, user, args) {
  if (!args || args.length === 0) {
    return 'Please specify who you want to hug!';
  }

  let targetUser;
  try {
    targetUser = validateUsername(args[0]);
  } catch (error) {
    return 'Invalid username provided';
  }

  // Prevent self-hugs (optional, remove if you want to allow them)
  if (targetUser.toLowerCase() === user.username.toLowerCase()) {
    return `${user.username}, you can't hug yourself! Try hugging someone else! 🤗`;
  }

  try {
    const prompt = createHugPrompt(user.username, targetUser);
    const response = await generateResponse(prompt);

    if (!response || typeof response !== 'string' || response.length < 20) {
      logger.warn('Invalid AI response for hug command:', { response });
      return getFallbackMessage(user.username, targetUser);
    }

    // Clean and format the response
    let cleanResponse = response
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^["']|["']$/g, '')
      .replace(/^(hey\s+|hello\s+|hi\s+)/i, '')
      .replace(/\b(sends|gives|shares)\b/g, '') // Remove common repetitive verbs
      .trim();

    // Add username if missing
    if (!cleanResponse.toLowerCase().startsWith(user.username.toLowerCase())) {
      cleanResponse = `${user.username}: ${cleanResponse}`;
    }

    // Ensure message isn't too long
    if (cleanResponse.length > 150) {
      cleanResponse = cleanResponse.substring(0, 147) + '...';
    }

    // Add emojis if not enough present
    const emojiCount = (cleanResponse.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
    if (emojiCount < 2) {
      const emojis = ['🤗', '💝', '🫂', '❤️', '✨', '💫'];
      while ((cleanResponse.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length < 2) {
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        cleanResponse += ` ${emoji}`;
      }
    }

    return cleanResponse;
  } catch (error) {
    logger.error('Error generating hug message:', error);
    return getFallbackMessage(user.username, targetUser);
  }
}
