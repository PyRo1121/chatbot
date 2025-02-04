import express from 'express';
import { ApiClient } from '@twurple/api';
import { RefreshingAuthProvider } from '@twurple/auth';
import { promises as fs } from 'fs';
import { join } from 'path';
import logger from '../utils/logger.js';

const app = express();
const port = 3001;

async function loadTokens() {
  try {
    const data = await fs.readFile(join(process.cwd(), 'bot_tokens.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.error('Error loading bot tokens:', error);
    return null;
  }
}

async function saveTokens(tokens) {
  try {
    await fs.writeFile(join(process.cwd(), 'bot_tokens.json'), JSON.stringify(tokens, null, 2));
  } catch (error) {
    logger.error('Error saving bot tokens:', error);
  }
}

app.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    res.send('No code provided');
    return;
  }

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

      res.send('Bot authentication successful! You can close this window.');
    } else {
      res.send('Failed to get bot access token');
    }
  } catch (error) {
    logger.error('Bot auth error:', error);
    res.send('Bot authentication failed');
  }
});

app.listen(port, () => {
  logger.info(`Bot auth server running at http://localhost:${port}`);

  const scopes = [
    'chat:read',
    'chat:edit',
    'channel:moderate',
    'whispers:read',
    'whispers:edit',
    'channel:manage:broadcast',
    'clips:edit',
  ];

  const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${
    process.env.TWITCH_CLIENT_ID
  }&redirect_uri=http://localhost:${port}/callback&response_type=code&scope=${encodeURIComponent(
    scopes.join(' ')
  )}`;

  logger.info('Visit this URL to authenticate the bot:', authUrl);
});

process.on('SIGINT', () => {
  logger.info('Bot auth server shutting down');
  process.exit();
});
