import express from 'express';
import fetch from 'node-fetch';
import tokenManager from './tokenManager.js';
import 'dotenv/config';

const app = express();
const port = 8888;

app.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    res.status(400).send('No authorization code received');
    return;
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: 'http://localhost:8888/callback',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
    }

    // Update environment variables with new tokens
    await tokenManager.updateEnvFile({
      TWITCH_ACCESS_TOKEN: tokenData.access_token,
      TWITCH_REFRESH_TOKEN: tokenData.refresh_token,
    });

    console.log('✅ Successfully obtained broadcaster tokens!');
    console.log('Access Token:', tokenData.access_token);
    console.log('Refresh Token:', tokenData.refresh_token);

    res.send(`
      <h1>Authorization Successful!</h1>
      <p>Your broadcaster tokens have been saved. You can close this window and restart the bot.</p>
      <script>
        setTimeout(() => window.close(), 3000);
      </script>
    `);
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    res.status(500).send(`Error getting access token: ${error.message}`);
  }
});

app.listen(port, () => {
  console.log(`Broadcaster auth server running at http://localhost:${port}`);
});
