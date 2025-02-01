import { generateResponse } from '../../utils/perplexity.js';
import logger from '../../utils/logger.js';

// Track last roast time for each user
const lastRoastTime = new Map();
const COOLDOWN = 5 * 60 * 1000; // 5 minutes

// Single strong template that maintains appropriate boundaries
const ROAST_TEMPLATE =
  'Generate an absolutely brutal, savage roast for {target}. Go completely unhinged with devastating analogies and ruthless mockery of their life choices, personality, and general existence. Use creative metaphors and absurd comparisons to obliterate their self-esteem. Focus on their questionable decision-making, lack of achievements, and general mediocrity. Make it psychologically devastating with dark humor and existential dread (but avoid slurs/bigotry/discrimination/appearance/violence). This is an 18+ community - make them question every life choice that led to this moment. Be creative, philosophical, and absolutely merciless. Length: 300-500 characters.';

export async function handleRoast(client, channel, user, args) {
  logger.debug('handleRoast called:', {
    channel,
    username: user.username,
    args,
  });

  try {
    // Check if target is specified
    const target = args ? args.replace('@', '') : user.username;
    logger.debug('Roast target:', { target });

    // Check cooldown
    const now = Date.now();
    const lastRoast = lastRoastTime.get(target);
    if (lastRoast && now - lastRoast < COOLDOWN) {
      const remainingTime = Math.ceil(
        (COOLDOWN - (now - lastRoast)) / 1000 / 60
      );
      return `@${user.username}, please wait ${remainingTime} minutes before roasting ${target} again!`;
    }

    const prompt = ROAST_TEMPLATE.replace('{target}', target);

    logger.debug('Generating roast with prompt:', { prompt });
    let roast = await generateResponse(prompt);
    logger.debug('Generated roast:', { roast });

    if (!roast) {
      logger.error('No roast generated');
      return `Sorry @${user.username}, I couldn't think of a good roast right now!`;
    }

    // Ensure roast starts with fire emoji
    if (!roast.startsWith('🔥')) {
      roast = `🔥 ${roast}`;
    }

    // Remove quotes and emojis (except the initial fire and skull)
    roast = roast.replace(/["']/g, '');
    roast = roast.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
    if (!roast.startsWith('🔥')) {
      roast = `🔥 💀 ${roast}`;
    }

    // Remove any gaming/streaming references and weak words
    const streamTerms = [
      /\b(?:stream(?:er|ing)?|twitch|chat|viewer|mod|sub|clip|emote|lag|gameplay|channel)\b/gi,
      /\b(?:no(?:scope|signal))\b/gi,
      /\b(?:technical difficulties)\b/gi,
      /\b(?:game(?:r|play)?|skill|aim|mechanics|ranked|bronze|silver|gold|platinum|diamond)\b/gi,
      /\b(?:maybe|perhaps|kind of|sort of|a bit|slightly)\b/gi,
      /\b(?:nice|good|okay|fine|alright)\b/gi,
    ];

    for (const term of streamTerms) {
      roast = roast.replace(term, '');
    }

    // Clean up any double spaces from removals
    roast = roast.replace(/\s+/g, ' ').trim();
    if (!roast.startsWith('🔥')) {
      roast = `🔥 ${roast}`;
    }

    // Ensure length is between 300-500 characters
    if (roast.length < 300) {
      logger.debug('Roast too short, regenerating');
      return handleRoast(client, channel, user, args);
    }

    if (roast.length > 500) {
      roast = `${roast.substring(0, 497)}...`;
    }

    // Update cooldown
    lastRoastTime.set(target, now);

    // Clean up old cooldowns periodically
    if (lastRoastTime.size > 1000) {
      for (const [username, time] of lastRoastTime.entries()) {
        if (now - time > COOLDOWN) {
          lastRoastTime.delete(username);
        }
      }
    }

    return roast;
  } catch (error) {
    logger.error('Error generating roast:', error);
    return `Sorry @${user.username}, something went wrong with the roast!`;
  }
}
