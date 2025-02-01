<<<<<<< HEAD
import open from 'open';
import 'dotenv/config';
import './broadcasterAuthServer.js';

console.log('Starting broadcaster authentication process...');

const clientId = process.env.TWITCH_CLIENT_ID;
const redirectUri = 'http://localhost:8888/callback';

// Define required scopes for the broadcaster account
const scopes = [
  'channel:read:subscriptions',
  'moderator:read:followers',
  'channel:read:vips',
  'user:read:follows',
  'user:read:subscriptions',
  'user:read:broadcast',
  'analytics:read:games',
  'channel:read:redemptions',
  'moderator:read:chatters',
].join(' ');

const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}`;

console.log('Opening browser for broadcaster account authorization...');
console.log('Please log in with your MAIN BROADCASTER account');
console.log('\nIf browser does not open automatically, visit:');
console.log(authUrl);

console.log('Waiting for auth server to start...');
setTimeout(() => {
  console.log('Opening browser for authorization...');
  open(authUrl);
}, 1000);
=======
import open from 'open';
import 'dotenv/config';
import './broadcasterAuthServer.js';

console.log('Starting broadcaster authentication process...');

const clientId = process.env.TWITCH_CLIENT_ID;
const redirectUri = 'http://localhost:8888/callback';

// Define required scopes for the broadcaster account
const scopes = [
  'channel:read:subscriptions',
  'moderator:read:followers',
  'channel:read:vips',
  'user:read:follows',
  'user:read:subscriptions',
  'user:read:broadcast',
  'analytics:read:games',
  'channel:read:redemptions',
  'moderator:read:chatters',
].join(' ');

const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes}`;

console.log('Opening browser for broadcaster account authorization...');
console.log('Please log in with your MAIN BROADCASTER account');
console.log('\nIf browser does not open automatically, visit:');
console.log(authUrl);

console.log('Waiting for auth server to start...');
setTimeout(() => {
  console.log('Opening browser for authorization...');
  open(authUrl);
}, 1000);
>>>>>>> origin/master
