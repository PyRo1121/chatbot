#!/usr/bin/env node
import express from 'express';
import SpotifyWebApi from 'spotify-web-api-node';
import 'dotenv/config';
import logger from '../utils/logger.js';

const scopes = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-modify-public',
  'playlist-modify-private',
];

if (
  !process.env.SPOTIFY_CLIENT_ID ||
  !process.env.SPOTIFY_CLIENT_SECRET ||
  !process.env.SPOTIFY_REDIRECT_URI
) {
  console.error(`
Please set the following environment variables in your .env file:
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
`);
  process.exit(1);
}

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI,
});

const app = express();

app.get('/login', (req, res) => {
  const authorizeURL = spotifyApi.createAuthorizeURL(scopes);
  res.redirect(authorizeURL);
});

app.get('/callback', async (req, res) => {
  const { code } = req.query;

  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token } = data.body;

    console.log('\n=== Your Spotify Refresh Token ===');
    console.log(refresh_token);
    console.log('\nAdd this to your .env file as SPOTIFY_REFRESH_TOKEN=your_token\n');

    res.send(`
      <h1>Success!</h1>
      <p>Your Spotify refresh token has been generated and displayed in the terminal.</p>
      <p>Add it to your .env file as SPOTIFY_REFRESH_TOKEN=your_token</p>
      <p>You can close this window now.</p>
    `);

    // Give user time to copy the token
    setTimeout(() => {
      process.exit(0);
    }, 30000);
  } catch (error) {
    logger.error('Error getting refresh token:', error);
    res.status(500).send('Error getting refresh token. Check the console for details.');
  }
});

const port = 3000;
app.listen(port, () => {
  console.log(`
=== Spotify Auth Token Generator ===
1. Make sure you have set up your Spotify application at https://developer.spotify.com/dashboard
2. Ensure your .env file has SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET from your Spotify app
3. Visit http://localhost:${port}/login to start the auth process
4. After authorizing, your refresh token will be displayed here
`);
});
