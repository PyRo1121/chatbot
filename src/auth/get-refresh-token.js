import SpotifyWebApi from 'spotify-web-api-node';
import open from 'open';
import express from 'express';
import { config } from 'dotenv';
import logger from '../utils/logger.js';

config();

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI,
});

const app = express();
const port = 3000;

app.get('/callback', async (req, res) => {
  const { code } = req.query;

  try {
    const data = await spotifyApi.authorizationCodeGrant(code);

    console.log('Retrieved refresh token:', data.body.refresh_token);
    console.log('\nAdd this refresh token to your .env file as SPOTIFY_REFRESH_TOKEN');

    res.send('Authorization successful! You can close this window.');

    // Exit after a delay to allow the message to be sent
    setTimeout(() => process.exit(0), 1000);
  } catch (error) {
    logger.error('Error getting refresh token:', error);
    res.status(500).send('Error getting refresh token');
  }
});

const scopes = [
  'user-read-currently-playing',
  'user-modify-playback-state',
  'user-read-playback-state',
  'playlist-modify-public',
  'playlist-modify-private',
];

app.listen(port, () => {
  const authUrl = spotifyApi.createAuthorizeURL(scopes);
  console.log('Opening Spotify authorization in your browser...');
  open(authUrl);

  console.log(`\nAfter authorizing, the callback URL will open in your browser.
If it shows "Cannot GET /callback", this is normal - the bot will handle the authentication.`);
});
