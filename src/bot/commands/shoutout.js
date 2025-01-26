import viewerManager from '../viewerManager.js';

export const handleShoutout = {
  name: 'shoutout',
  description: 'Give a shoutout to another streamer',
  usage: '!shoutout <username>',
  async execute(client, channel, tags, args) {
    const username = args[0]?.replace('@', '').toLowerCase();

    if (!username) {
      return client.say(
        channel,
        'Please specify a username to shoutout! Usage: !shoutout <username>'
      );
    }

    // Don't allow self-shoutouts
    if (username === tags.username.toLowerCase()) {
      return client.say(channel, "Nice try, but you can't shoutout yourself!");
    }

    try {
      const message = await viewerManager.generateShoutout(username);
      return client.say(channel, message);
    } catch (error) {
      console.error('Error executing shoutout command:', error);
      return client.say(channel, `Check out @${username}! They're awesome!`);
    }
  },
};
