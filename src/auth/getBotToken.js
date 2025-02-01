<<<<<<< HEAD
import open from 'open';
import 'dotenv/config';

const clientId = process.env.TWITCH_BOT_CLIENT_ID;
const redirectUri = 'http://localhost:8888/callback';

// Define required scopes for the bot
const scopes = [
  'chat:read',
  'chat:edit',
  'channel:moderate',
  'whispers:read',
  'whispers:edit',
  'channel:read:subscriptions',
  'channel:read:redemptions',
  'channel:read:stream_key',
  'channel:read:vips',
  'moderation:read',
  'moderator:read:followers',
  'moderator:manage:banned_users',
  'moderator:manage:chat_messages',
  'user:read:follows',
  'user:read:subscriptions',
  'user:bot',
].join(' ');

const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}`;

console.log('Opening browser for bot account authorization...');
console.log('Please log in with the BOT account (FirePigBot)');
console.log('\nIf browser does not open automatically, visit:');
console.log(authUrl);

open(authUrl);
=======
import open from 'open';
import 'dotenv/config';

const clientId = process.env.TWITCH_BOT_CLIENT_ID;
const redirectUri = 'http://localhost:8888/callback';

// Define required scopes for the bot
const scopes = [
  'chat:read',
  'chat:edit',
  'channel:moderate',
  'whispers:read',
  'whispers:edit',
  'channel:read:subscriptions',
  'channel:read:redemptions',
  'channel:read:stream_key',
  'channel:read:vips',
  'moderation:read',
  'moderator:read:followers',
  'moderator:manage:banned_users',
  'moderator:manage:chat_messages',
  'user:read:follows',
  'user:read:subscriptions',
  'user:bot',
].join(' ');

const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}`;

console.log('Opening browser for bot account authorization...');
console.log('Please log in with the BOT account (FirePigBot)');
console.log('\nIf browser does not open automatically, visit:');
console.log(authUrl);

open(authUrl);
>>>>>>> origin/master
