const SpotifyWebApi = require('spotify-web-api-node');
const { exec } = require('child_process');
require('dotenv').config();

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI,
});

// Generate authorization URL
const scopes = [
  'user-read-currently-playing',
  'user-modify-playback-state',
  'user-read-playback-state',
];
const authUrl = spotifyApi.createAuthorizeURL(scopes);

console.log('Opening Spotify authorization in your browser...');
exec(`start ${authUrl}`);

console.log(`\nAfter authorizing, the callback URL will open in your browser.
If it shows "Cannot GET /callback", this is normal - the bot will handle the authentication.`);
