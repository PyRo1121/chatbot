import express from 'express';
import axios from 'axios';
import open from 'open';
import querystring from 'querystring';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = 8888;

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

console.log('Loaded Spotify Client ID:', SPOTIFY_CLIENT_ID ? '***' : 'Not found');
console.log('Loaded Spotify Client Secret:', SPOTIFY_CLIENT_SECRET ? '***' : 'Not found');

app.get('/callback', async (req, res) => {
  const code = req.query.code || null;
  
  try {
    const authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      method: 'post',
      params: {
        code: code,
        redirect_uri: 'http://localhost:8888/callback',
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    const response = await axios(authOptions);
    const refreshToken = response.data.refresh_token;
    
    console.log('\nYour Spotify refresh token is:');
    console.log(refreshToken);
    console.log('\nAdd this to your .env file as SPOTIFY_REFRESH_TOKEN');
    
    res.send('Refresh token received! You can close this window.');
    process.exit();
  } catch (error) {
    console.error('Error getting refresh token:', error.response ? error.response.data : error.message);
    res.send('Error getting refresh token. Check console for details.');
    process.exit(1);
  }
});

app.listen(port, () => {
  const authUrl = 'https://accounts.spotify.com/authorize?' + querystring.stringify({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: 'user-read-currently-playing user-read-playback-state',
    redirect_uri: 'http://localhost:8888/callback',
    show_dialog: true
  });

  console.log('Opening Spotify authorization in your browser...');
  open(authUrl);
});
