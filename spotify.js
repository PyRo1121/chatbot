import SpotifyWebApi from 'spotify-web-api-node';
import logger from './utils/logger.js';
import { generateResponse } from './openai.js';

class SpotifyClient {
  constructor() {
    this.queue = [];
    this.currentTrack = null;
    this.api = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      redirectUri: process.env.SPOTIFY_REDIRECT_URI,
      refreshToken: process.env.SPOTIFY_REFRESH_TOKEN
    });

    if (process.env.SPOTIFY_REFRESH_TOKEN) {
      this.refreshUserAccessToken();
      setInterval(() => this.refreshUserAccessToken(), 3500 * 1000); // Refresh every 58 minutes
    }
  }

  async refreshUserAccessToken() {
    try {
      const data = await this.api.refreshAccessToken();
      this.api.setAccessToken(data.body['access_token']);
      logger.info('Spotify user access token refreshed');
    } catch (error) {
      logger.error('Error refreshing Spotify user token:', error);
    }
  }

  getAuthorizationUrl() {
    const scopes = [
      'user-read-currently-playing',
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-private',
      'user-read-email',
      'playlist-read-private',
      'playlist-read-collaborative',
      'playlist-modify-public',
      'playlist-modify-private'
    ];
    return this.api.createAuthorizeURL(scopes, 'state');
  }

  async authorize(code) {
    try {
      const data = await this.api.authorizationCodeGrant(code);
      this.api.setAccessToken(data.body['access_token']);
      this.api.setRefreshToken(data.body['refresh_token']);
      return data.body;
    } catch (error) {
      logger.error('Error during Spotify authorization:', error);
      throw error;
    }
  }

  async getCurrentTrack() {
    try {
      const response = await this.api.getMyCurrentPlayingTrack();
      if (!response.body || !response.body.item) {
        return null;
      }
      
      const track = response.body.item;
      this.currentTrack = {
        name: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        duration: track.duration_ms,
        progress: response.body.progress_ms,
        is_playing: response.body.is_playing,
        url: track.external_urls.spotify
      };
      return this.currentTrack;
    } catch (error) {
      logger.error('Error getting current track:', error);
      return null;
    }
  }

  // Funny rejection messages
  rejectionMessages = [
    "Nice try, but that song is too spicy for this chat! 🌶️",
    "That request made my circuits tingle... in a bad way! ⚡",
    "I'm a bot, not a fool! Try again with something less... problematic 😅",
    "Even my AI brain knows that's not appropriate! 🤖",
    "That song request just got yeeted into the void 🕳️",
    "I'd play that... if I wanted to get banned! 😬"
  ];

  getRandomRejection() {
    return this.rejectionMessages[
      Math.floor(Math.random() * this.rejectionMessages.length)
    ];
  }

  async isContentAppropriate(text) {
    try {
      const prompt = `Analyze this text for racist content or obvious troll songs:
"${text}"

Respond ONLY with "true" if the content is appropriate (not racist and not a troll song) or "false" if it contains racist content or is clearly a troll song.`;
      
      const response = await generateResponse(prompt);
      return response?.toLowerCase()?.trim() === 'true';
    } catch (error) {
      logger.error('Error analyzing content:', error);
      return true; // Default to allowing if analysis fails
    }
  }

  async searchTrack(query) {
    try {
      // Check if query is appropriate
      if (!(await this.isContentAppropriate(query))) {
        return { 
          error: true,
          message: this.getRandomRejection()
        };
      }

      // Parse query to extract song name and artist
      let songName, artistName;
      if (query.toLowerCase().includes(' by ')) {
        const queryParts = query.toLowerCase().split(' by ');
        songName = queryParts[0].trim();
        artistName = queryParts[1]?.trim() || '';
      } else {
        // Try to parse song and artist from space-separated query
        const words = query.toLowerCase().split(' ');
        const artistIndex = words.findIndex(word => word === 'by' || word === 'from');
        if (artistIndex !== -1) {
          songName = words.slice(0, artistIndex).join(' ').trim();
          artistName = words.slice(artistIndex + 1).join(' ').trim();
        } else {
          songName = query.toLowerCase().trim();
          artistName = '';
        }
      }

      // Search with both the full query and a more specific query
      const [response1, response2] = await Promise.all([
        this.api.searchTracks(`${songName} ${artistName}`, { limit: 25 }),
        this.api.searchTracks(`"${songName}" artist:${artistName}`, { limit: 25 })
      ]);

      // Combine and deduplicate results
      const allTracks = [...response1.body.tracks.items];
      response2.body.tracks.items.forEach(track => {
        if (!allTracks.find(t => t.id === track.id)) {
          allTracks.push(track);
        }
      });

      if (!allTracks.length) {
        return null;
      }

      // Filter and score tracks based on match quality
      const tracks = allTracks
        .filter(track => {
          const trackArtistName = track.artists[0].name.toLowerCase();
          const trackName = track.name.toLowerCase();
          return !trackArtistName.includes('karaoke') && 
                 !trackArtistName.includes('tribute') &&
                 !trackArtistName.includes('made popular') &&
                 !trackArtistName.includes('backing') &&
                 !trackName.includes('karaoke') &&
                 !trackName.includes('tribute') &&
                 !trackName.includes('backing') &&
                 !trackName.includes('instrumental');
        })
        .map(track => {
          let score = 0;
          const trackName = track.name.toLowerCase();
          const trackArtist = track.artists[0].name.toLowerCase();

          // Exact matches get highest score
          if (trackName === songName) score += 100;
          if (trackArtist === artistName) score += 100;

          // Partial matches get lower scores
          if (trackName.includes(songName)) score += 50;
          if (artistName && trackArtist.includes(artistName)) score += 50;

          // Bonus points for exact word matches
          const songWords = songName.split(' ');
          const trackWords = trackName.split(' ');
          songWords.forEach(word => {
            if (trackWords.includes(word)) score += 10;
          });

          return { track, score };
        })
        .sort((a, b) => b.score - a.score);

      const originalTrack = tracks.length > 0 ? tracks[0].track : allTracks[0];
      
      // Check track name and artist
      const trackText = `${originalTrack.name} ${originalTrack.artists.map(a => a.name).join(' ')}`;
      
      if (!(await this.isContentAppropriate(trackText))) {
        return {
          error: true,
          message: this.getRandomRejection()
        };
      }

      return originalTrack;
    } catch (error) {
      logger.error('Error searching track:', error);
      return null;
    }
  }

  async addToQueue(trackUri) {
    try {
      // Get available devices with retry logic
      let devices;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          devices = await this.api.getMyDevices();
          if (devices.body.devices.length) break;
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          logger.error(`Error getting devices (attempt ${attempts + 1}):`, error);
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!devices?.body?.devices?.length) {
        logger.error('No Spotify devices found after retries');
        return { 
          success: false, 
          error: 'No Spotify devices available. Please make sure Spotify is running and you have an active device.'
        };
      }

      // Find active device or use the first available one
      const activeDevice = devices.body.devices.find(device => device.is_active) || devices.body.devices[0];
      logger.info(`Using Spotify device: ${activeDevice.name} (${activeDevice.type})`);

      // Transfer playback with retry logic and active device verification
      attempts = 0;
      let transferSuccess = false;
      let deviceActive = false;
      
      while (attempts < maxAttempts && !transferSuccess) {
        try {
          // Transfer playback
          await this.api.transferMyPlayback([activeDevice.id], { play: false });
          
          // Verify device is active
          const verifyDevices = await this.api.getMyDevices();
          deviceActive = verifyDevices.body.devices.some(
            device => device.id === activeDevice.id && device.is_active
          );
          
          if (deviceActive) {
            transferSuccess = true;
            logger.info('Successfully transferred playback and verified device is active');
          } else {
            throw new Error('Device not active after transfer');
          }
        } catch (error) {
          logger.error(`Error transferring playback (attempt ${attempts + 1}):`, error);
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!transferSuccess || !deviceActive) {
        logger.error('Failed to transfer playback or verify active device after retries');
        return { 
          success: false, 
          error: 'Failed to activate Spotify device. Please make sure Spotify is running and you have an active device.'
        };
      }

      // Wait a moment for the transfer to fully take effect
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Add to queue with retry logic
      attempts = 0;
      while (attempts < maxAttempts) {
        try {
          await this.api.addToQueue(trackUri);
          this.queue.push(trackUri);
          logger.info(`Successfully added track to queue: ${trackUri}`);
          return { success: true };
        } catch (error) {
          logger.error(`Error adding to queue (attempt ${attempts + 1}):`, error);
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      logger.error('Failed to add track to queue after retries');
      return { success: false, error: 'Failed to add to queue' };
    } catch (error) {
      logger.error('Unexpected error in addToQueue:', error);
      return { success: false, error: 'Unexpected error' };
    }
  }

  getQueue() {
    return this.queue;
  }

  clearQueue() {
    this.queue = [];
  }
}

const spotify = new SpotifyClient();
export default spotify;
