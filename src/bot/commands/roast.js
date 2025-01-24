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
    const response = await twitchClient.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content:
            "You are the world's most savage roast comedian with a PhD in psychological warfare. Your roasts are legendary for being uniquely brutal, hitting deep personal insecurities with surgical precision. Keep roasts under 500 characters using everyday language that cuts deep. Focus on devastating psychological takedowns about life choices, career failures, relationship disasters, and embarrassing personality traits. Mix dark humor with brutal truth. Incorporate creative metaphors and analogies that paint vivid pictures of failure. Each roast must be completely unique - never repeat patterns or formulas. This is an 18+ stream so adult themes are fine, but stay within Twitch TOS (no hate speech, discrimination, threats). Make each roast a unique masterpiece of psychological devastation.",
        },
        {
          role: 'user',
          content: `Generate a uniquely savage roast for Twitch user ${targetUser}. Focus on psychological warfare and creative brutality. Make it memorable and unlike any other roast. No gaming references, keep it deeply personal.`,
        },
      ],
      max_tokens: 125,
      temperature: 0.95,
    });

    // Update cooldown timer after successful roast
    userCooldowns.set(targetUser.toLowerCase(), now);

    return {
      success: true,
      message: `@${targetUser} ${response.choices[0].message.content}`,
    };
  } catch {
    return {
      success: false,
      message: `Failed to roast ${targetUser}. Try again later.`,
    };
  }
}
