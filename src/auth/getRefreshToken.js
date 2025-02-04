import express from 'express';
import axios from 'axios';
import querystring from 'querystring';
import logger from '../utils/logger.js';

const { SPOTIFY_CLIENT_ID } = process.env;
const { SPOTIFY_CLIENT_SECRET } = process.env;

const app = express();
const port = 3000;

app.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    res.send('No code provided');
    return;
  }

  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      querystring.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'http://localhost:3000/callback',
      }),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
          ).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { refresh_token: refreshToken } = response.data;
    console.log('Refresh token:', refreshToken);
    res.send('Got refresh token! Check console.');
  } catch (error) {
    logger.error(
      'Error getting refresh token:',
      error.response ? error.response.data : error.message
    );
    res.send('Error getting refresh token. Check console for details.');
  }
});

app.listen(port, () => {
  console.log(`Auth server running at http://localhost:${port}`);

  // Generate auth URL
  const authUrl = `https://accounts.spotify.com/authorize?${querystring.stringify({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: 'user-read-playback-state user-modify-playback-state user-read-currently-playing',
    redirect_uri: 'http://localhost:3000/callback',
  })}`;

  console.log('Visit this URL to get your refresh token:', authUrl);
});
