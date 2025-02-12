import { generateResponse } from '../../utils/gemini.js';

export async function handleHug(channel, user, message = '') {
  try {
    // Get username from Twitch user object structure
    const username = user?.displayName
      ?? user?.user?.displayName
      ?? user?.username
      ?? user?.user?.login
      ?? (typeof user === 'string' ? user : 'Anonymous');

    // Ensure message is a string and normalize it
    const messageStr = String(message || '').trim();

    // If no message/target provided, it's a self hug
    if (!messageStr) {
      const selfHugPrompt = `Generate a warm self-hug message for ${username}. Include an emoji. Keep it under 80 characters.`;
      const response = await generateResponse(selfHugPrompt, '!hug');
      return `@${username} ${response.length > 80 ? `${response.slice(0, 77)}...` : response}`;
    }

    // Extract target user using same logic as sender
    // Extract first mention/word from message string
    const [targetPart] = messageStr.split(/\s+/);
    const target = targetPart.startsWith('@')
      ? targetPart.slice(1)
      : targetPart;

    // Generate hug response for other user
    const hugActions = [
      'gives a big friendly hug to',
      'wraps in a warm embrace',
      'shares a cozy hug with',
      'sends a heartfelt hug to',
      'surrounds with a gentle hug',
    ];
    const randomAction = hugActions[Math.floor(Math.random() * hugActions.length)];
    return `@${target} *${username} ${randomAction} @${target}* 🤗`;
  } catch (error) {
    console.error('Error generating hug:', error);
    const errorUser = user?.displayName
      || user?.user?.displayName
      || user?.username
      || user?.user?.login
      || (typeof user === 'string' ? user : 'Anonymous');
    return `@${errorUser} tried to send a hug but something went wrong!`;
  }
}
