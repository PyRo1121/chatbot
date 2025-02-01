import express from 'express';
import { ApiClient } from '@twurple/api';
import { RefreshingAuthProvider } from '@twurple/auth';
import { promises as fs } from 'fs';
import { join } from 'path';
import logger from '../utils/logger.js';

const app = express();
const port = 3000;

// Load tokens from file
async function loadTokens() {
  try {
    const data = await fs.readFile(join(process.cwd(), 'tokens.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.error('Error loading tokens:', error);
    return {
      accessToken: '',
      refreshToken: '',
      expiresIn: 0,
      obtainmentTimestamp: 0,
    };
  }
}

// Save tokens to file
async function saveTokens(tokens) {
  try {
    await fs.writeFile(
      join(process.cwd(), 'tokens.json'),
      JSON.stringify(tokens, null, 2)
    );
  } catch (error) {
    logger.error('Error saving tokens:', error);
  }
}

app.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (code) {
    try {
      const authProvider = new RefreshingAuthProvider(
        {
          clientId: process.env.TWITCH_CLIENT_ID,
          clientSecret: process.env.TWITCH_CLIENT_SECRET,
          onRefresh: async (userId, newTokenData) => {
            await saveTokens(newTokenData);
          },
        },
        await loadTokens()
      );

      const apiClient = new ApiClient({ authProvider });
      const token = await apiClient.getAccessToken();

      if (token) {
        await saveTokens({
          accessToken: token,
          refreshToken: code,
          expiresIn: 14400,
          obtainmentTimestamp: Date.now(),
        });

        res.send('Authentication successful! You can close this window.');
      } else {
        res.send('Failed to get access token');
      }
    } catch (error) {
      logger.error('Auth error:', error);
      res.send('Authentication failed');
    }
  } else {
    res.send('No code provided');
  }
});

app.listen(port, () => {
  logger.info(`Auth server running at http://localhost:${port}`);

  // Generate auth URL
  const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${
    process.env.TWITCH_CLIENT_ID
  }&redirect_uri=http://localhost:${port}/callback&response_type=code&scope=${encodeURIComponent(
    'chat:read chat:edit channel:moderate whispers:read whispers:edit channel:read:subscriptions'
  )}`;

  logger.info('Visit this URL to authenticate:', authUrl);
});

process.on('SIGINT', () => {
  logger.info('Auth server shutting down');
  process.exit();
});
