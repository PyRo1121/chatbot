import SpotifyWebApi from 'spotify-web-api-node';

const api = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

const scopes = ['user-read-private', 'user-read-email'];
const state = 'some-state-of-my-choice';

const authorizeURL = api.createAuthorizeURL(scopes, state);
console.log('Visit this URL to authorize:');
console.log(authorizeURL);
