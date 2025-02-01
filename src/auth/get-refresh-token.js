import SpotifyWebApi from 'spotify-web-api-node';
import dotenv from 'dotenv';

dotenv.config();

console.log('Using client ID:', process.env.SPOTIFY_CLIENT_ID);
console.log('Using client secret:', process.env.SPOTIFY_CLIENT_SECRET ? '***' : 'undefined');

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

// Get client credentials access token
spotifyApi
  .clientCredentialsGrant()
  .then((data) => {
    console.log('Access token:', data.body.access_token);
    console.log('Expires in:', data.body.expires_in);
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error details:');
    console.error('Status code:', err.statusCode);
    console.error('Headers:', err.headers);
    console.error('Body:', err.body);
    process.exit(1);
  });
