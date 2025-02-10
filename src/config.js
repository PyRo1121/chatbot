require('dotenv').config();

module.exports = {
  twitchUsername: process.env.TWITCH_USERNAME,
  twitchToken: process.env.TWITCH_TOKEN,
  twitchChannel: process.env.TWITCH_CHANNEL,
  deepaiKey: process.env.GEMINI_API_KEY,

  // Streamer Profile for Personalized Interactions
  streamerProfile: {
    name: 'Olen',
    nickname: 'The Coding Streamer',
    schedule: 'Mon/Wed/Fri 7-10pm CST',
    favoriteGames: ['Valorant', 'Minecraft', 'Factorio'],
    contentFocus: 'Coding tutorials and game development',
    communityValues: ['Supportive', 'Inclusive', 'Fun-loving'],
    catchphrases: ["Let's get coding!", 'Debugging is life!', 'Another day, another bug to squash'],
    traditions: ['Friday Night Code & Chill', 'Monthly Game Jam Challenges', 'Viewer Code Reviews'],
    socialLinks: {
      twitter: '@PyRo1121',
      discord: 'discord.gg/bQkqV96qqX',
    },
  },
};
