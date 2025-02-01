import express from 'express';
import fetch from 'node-fetch';
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
    // Exchange the code for an access token
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.TWITCH_BOT_CLIENT_ID,
        client_secret: process.env.TWITCH_BOT_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: 'http://localhost:8888/callback',
      }),
    });

    const data = await tokenResponse.json();

    if (data.access_token) {
      console.log('\nUpdate your .env file with these new values:');
      console.log(`TWITCH_BOT_ACCESS_TOKEN=${data.access_token}`);
      console.log(`TWITCH_OAUTH_TOKEN=oauth:${data.access_token}`);
      console.log(`TWITCH_BOT_REFRESH_TOKEN=${data.refresh_token}`);

      res.send(
        'Authorization successful! You can close this window and update your .env file with the new tokens shown in the terminal.'
      );
    } else {
      console.error('Failed to get token:', data);
      res.status(500).send('Failed to get access token');
    }
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    res.status(500).send('Error getting access token');
  }
});

app.listen(port, () => {
  console.log(`Auth server running at http://localhost:${port}`);
});
