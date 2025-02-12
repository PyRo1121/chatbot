import { generateResponse } from '../utils/gemini.js';
import logger from '../utils/logger.js';
import songLearning from './songLearning.js';
import spotifyAuth from '../auth/spotifyAuth.js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import musicService from '../utils/musicService.js';

class SpotifyManager {
  constructor() {
    this.songQueue = this.loadSongQueue();
    this.currentSong = null;
    this.skipVotes = new Map();
    this.voteThreshold = 3;
    this.playlistId = process.env.SPOTIFY_PLAYLIST_ID;
    this.searchCache = new Map(); // Add search cache
    this.CACHE_TTL = 3600000; // 1 hour in milliseconds
  }

  loadSongQueue() {
    try {
      const data = readFileSync(join(process.cwd(), 'src/spotify/song_queue.json'), 'utf8');
      const parsed = JSON.parse(data);

      // If the file contains just an array, migrate it to the new structure
      if (Array.isArray(parsed)) {
        return {
          queue: parsed,
          history: [],
          settings: {
            maxQueueLength: 50,
            userSongLimit: 999999, // Effectively no limit
            duplicateDelay: 3600, // 1 hour in seconds
          },
        };
      }

      // Ensure all required properties exist
      return {
        queue: parsed.queue || [],
        history: parsed.history || [],
        settings: {
          maxQueueLength: parsed.settings?.maxQueueLength || 50,
          userSongLimit: parsed.settings?.userSongLimit || 999999,
          duplicateDelay: parsed.settings?.duplicateDelay || 3600,
        },
      };
    } catch (error) {
      logger.error('Error loading song queue:', error);
      return {
        queue: [],
        history: [],
        settings: {
          maxQueueLength: 50,
          userSongLimit: 999999,
          duplicateDelay: 3600, // 1 hour in seconds
        },
      };
    }
  }

  saveSongQueue() {
    try {
      // Create a clean copy without any non-serializable data
      const queueToSave = {
        queue: this.songQueue.queue.map((song) => ({
          query: song.query,
          trackInfo: song.trackInfo,
          requestedBy: song.requestedBy,
          timestamp: song.timestamp,
        })),
        history: this.songQueue.history.map((song) => ({
          query: song.query,
          trackInfo: song.trackInfo,
          requestedBy: song.requestedBy,
          timestamp: song.timestamp,
        })),
        settings: { ...this.songQueue.settings },
      };

      writeFileSync(
        join(process.cwd(), 'src/spotify/song_queue.json'),
        JSON.stringify(queueToSave, null, 2)
      );
    } catch (error) {
      logger.error('Error saving song queue:', error);
    }
  }

  normalizeTitle(title) {
    return title
      .toLowerCase()
      .replace(/['"]/g, '') // Remove quotes
      .replace(/\(.*?\)/g, '') // Remove content in parentheses
      .replace(/\[.*?\]/g, '') // Remove content in brackets
      .replace(/feat\.?|ft\.?/i, '') // Remove feat./ft.
      .replace(/\s+/g, ' ')
      .trim();
  }

  async searchTrack(query) {
    try {
      const spotifySearchFn = (searchQuery) =>
        spotifyAuth.retryOperation(async (api) => {
          // Try different search strategies
          let searchResults = [];

          // Strategy 1: Direct search with original query
          let response = await api.searchTracks(searchQuery);
          searchResults = response.body.tracks?.items || [];

          // Strategy 2: Try artist-based search if no results
          if (!searchResults.length) {
            const artistMatches = searchQuery.match(/(?:by|-)?\s*([^-]+)$/i);
            if (artistMatches) {
              const artist = artistMatches[1].trim();
              const title = searchQuery
                .replace(new RegExp(`(?:by|-)?\\s*${artist}$`, 'i'), '')
                .trim();
              response = await api.searchTracks(`track:${title} artist:${artist}`);
              searchResults = response.body.tracks?.items || [];
            }
          }

          if (searchResults.length > 0) {
            const track = searchResults[0]; // Take the most relevant result
            return {
              id: track.id,
              name: track.name,
              artist: track.artists[0].name,
              uri: track.uri,
              genres: track.artists[0].genres || [],
              popularity: track.popularity,
            };
          }

          return null;
        });

      // Use MusicService to find the best match across multiple sources
      const result = await musicService.findSong(
        query,
        spotifySearchFn,
        process.env.LASTFM_API_KEY
      );

      if (result.exists && result.spotifyTrack) {
        return result.spotifyTrack;
      }

      return null;
    } catch (error) {
      logger.error('Error searching for track:', error);
      return null;
    }
  }

  async handleSongRequest(query, username) {
    try {
      // Clean and validate song name
      const cleanQuery = query
        .trim()
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s\-'",.!?]/g, '');

      if (cleanQuery.length === 0) {
        return `@${username}, please provide a valid song name.`;
      }

      // Check if user has reached their song limit
      const userSongs = this.songQueue.queue.filter((song) => song.requestedBy === username).length;
      if (userSongs >= this.songQueue.settings.userSongLimit) {
        return `@${username}, you've reached your song request limit (${this.songQueue.settings.userSongLimit} songs)!`;
      }

      // Check if song was recently played
      const recentlyPlayed = this.songQueue.history.some(
        (song) =>
          song.query.toLowerCase() === cleanQuery.toLowerCase() &&
          Date.now() - song.timestamp < this.songQueue.settings.duplicateDelay * 1000
      );
      if (recentlyPlayed) {
        return `@${username}, that song was played recently! Please wait before requesting it again.`;
      }

      // Check queue length
      if (this.songQueue.queue.length >= this.songQueue.settings.maxQueueLength) {
        return `@${username}, the song queue is full! Please try again later.`;
      }

      // Check for karaoke/troll patterns before searching
      if (songLearning.isKaraokeVersion(cleanQuery)) {
        songLearning.addRejectedSong(cleanQuery, 'karaoke_version');
        return `@${username}, please request the original version of the song, not a karaoke version!`;
      }

      if (songLearning.isTrollSong(cleanQuery)) {
        songLearning.addRejectedSong(cleanQuery, 'troll_song');
        return `@${username}, that song is not allowed (marked as potential troll song).`;
      }

      // Search for the track
      const track = await this.searchTrack(cleanQuery);
      if (!track) {
        songLearning.addRejectedSong(cleanQuery, 'not_found');
        return `@${username}, couldn't find that song on Spotify. Please try a different search!`;
      }

      // Add song to queue
      const songRequest = {
        query: cleanQuery,
        trackInfo: track,
        requestedBy: username,
        timestamp: Date.now(),
      };

      this.songQueue.queue.push(songRequest);
      this.saveSongQueue();

      // Learn from request with track info
      await songLearning.learnFromRequest(cleanQuery, username, track);

      // Add to Spotify queue
      try {
        await spotifyAuth.retryOperation(async (api) => {
          // Get available devices
          const devices = await api.getMyDevices();
          if (!devices.body.devices.length) {
            throw new Error('No Spotify devices found. Please open Spotify on any device.');
          }

          // Find active device or use the first available one
          let activeDevice = devices.body.devices.find((d) => d.is_active);
          if (!activeDevice) {
            // Try to activate the first device
            [activeDevice] = devices.body.devices;
            try {
              await api.transferMyPlayback([activeDevice.id]);
              // Wait longer for the device to activate (3 seconds)
              await new Promise((resolve) => setTimeout(resolve, 3000));

              // Verify device was activated
              const updatedDevices = await api.getMyDevices();
              activeDevice = updatedDevices.body.devices.find((d) => d.is_active);
              if (!activeDevice) {
                throw new Error('Failed to activate Spotify device');
              }
            } catch (activateError) {
              logger.error('Error activating Spotify device:', activateError);
              throw new Error(
                'Failed to activate Spotify device. Please ensure Spotify is open and try again.'
              );
            }
          }

          try {
            // Add to queue and playlist
            await api.addToQueue(track.uri);

            // If playlist ID is configured, add to playlist as well
            if (this.playlistId) {
              try {
                await api.addTracksToPlaylist(this.playlistId, [track.uri]);
                logger.info(`Added ${track.name} to playlist ${this.playlistId}`);
              } catch (playlistError) {
                logger.error('Error adding to playlist:', playlistError);
                // Don't throw - we still added to queue successfully
              }
            }
          } catch (queueError) {
            logger.error('Error adding to Spotify queue:', queueError);
            throw new Error('Failed to add song to Spotify queue. Please try again.');
          }
        });
      } catch (error) {
        logger.error('Error adding to Spotify queue:', error);

        // Handle specific error cases
        if (error.message.includes('No Spotify devices found')) {
          const playlistMsg = this.playlistId ? ' and playlist' : '';
          return `@${username}, added "${track.name} - ${track.artist}" to the queue${playlistMsg}, but couldn't add to Spotify - please open Spotify on any device first!`;
        }
        if (error.message.includes('Failed to activate Spotify device')) {
          const playlistMsg = this.playlistId ? ' and playlist' : '';
          return `@${username}, added "${track.name} - ${track.artist}" to the queue${playlistMsg}, but couldn't activate Spotify. Please ensure Spotify is open and playing!`;
        }
        if (error.message.includes('Failed to add song to Spotify queue')) {
          const playlistMsg = this.playlistId ? ' and playlist' : '';
          return `@${username}, added "${track.name} - ${track.artist}" to the queue${playlistMsg}, but there was an issue adding it to Spotify. Will retry automatically!`;
        }

        // For unknown errors, add to queue but warn about Spotify issue
        logger.error('Unknown Spotify error:', error);
        const playlistMsg = this.playlistId ? ' and playlist' : '';
        return `@${username}, added "${track.name} - ${track.artist}" to the queue${playlistMsg}! (Note: Spotify integration temporarily unavailable)`;
      }

      return `@${username}, added "${track.name} - ${track.artist}" to the queue! Position: ${this.songQueue.queue.length}`;
    } catch (error) {
      logger.error('Error handling song request:', error);
      return `@${username}, there was an error processing your song request. Please try again later.`;
    }
  }

  async generateSongSuggestion(context) {
    try {
      // Get recent songs with full track info
      const recentSongs = this.songQueue.history
        .slice(-5)
        .map((s) => (s.trackInfo ? `${s.trackInfo.name} - ${s.trackInfo.artist}` : s.query));

      const prompt = `Based on these recently played songs and chat activity, suggest a song that would fit the stream's mood:
      Recent Songs: ${recentSongs.join(', ')}
      Stream Context: ${context}
      
      Respond with just the song name and artist, e.g. "Song Name - Artist"`;

      const suggestion = await generateResponse(prompt);
      if (!suggestion) {
        return 'No suggestion available';
      }

      // Verify the suggestion exists on Spotify
      const track = await this.searchTrack(suggestion).catch(() => null);
      if (!track) {
        // Try one more time with a different prompt
        const retryPrompt = `Suggest a different song similar to: ${recentSongs[0]}. 
        Respond with just the song name and artist.`;

        const retrySuggestion = await generateResponse(retryPrompt);
        if (!retrySuggestion) {
          return 'No suggestion available';
        }

        const retryTrack = await this.searchTrack(retrySuggestion).catch(() => null);
        if (!retryTrack) {
          return 'No suggestion available';
        }

        return `${retryTrack.name} - ${retryTrack.artist}`;
      }

      return `${track.name} - ${track.artist}`;
    } catch (error) {
      logger.error('Error generating song suggestion:', error);
      return 'No suggestion available';
    }
  }

  async voteToSkip(username) {
    try {
      if (!this.currentSong) {
        return 'No song is currently playing!';
      }

      if (this.skipVotes.has(username)) {
        return `@${username}, you've already voted to skip this song!`;
      }

      this.skipVotes.set(username, true);
      const votes = this.skipVotes.size;

      if (votes >= this.voteThreshold) {
        try {
          await spotifyAuth.retryOperation(async (api) => {
            await api.skipToNext();
          });
          this.skipVotes.clear();
          return 'Skip vote passed! Skipping current song...';
        } catch (error) {
          logger.error('Error skipping track:', error);
          return 'Error skipping track. Please try again.';
        }
      }

      return `Skip vote registered! ${votes}/${this.voteThreshold} votes needed to skip.`;
    } catch (error) {
      logger.error('Error processing skip vote:', error);
      return 'Error processing skip vote. Please try again.';
    }
  }

  async clearQueue() {
    // Clear bot's queue
    this.songQueue.queue = [];
    this.saveSongQueue();
    return 'Song queue cleared!';
  }

  removeSong(index, username) {
    try {
      const songIndex = parseInt(index) - 1;
      if (isNaN(songIndex) || songIndex < 0 || songIndex >= this.songQueue.queue.length) {
        return 'Invalid song number!';
      }

      const song = this.songQueue.queue[songIndex];
      if (song.requestedBy !== username) {
        return 'You can only remove songs you requested!';
      }

      this.songQueue.queue.splice(songIndex, 1);
      this.saveSongQueue();
      return `Removed "${song.trackInfo ? `${song.trackInfo.name} - ${song.trackInfo.artist}` : song.query}" from the queue!`;
    } catch (error) {
      logger.error('Error removing song:', error);
      return 'Error removing song. Please try again.';
    }
  }

  getQueueStatus() {
    if (this.songQueue.queue.length === 0) {
      return 'The song queue is empty!';
    }

    const nextSongs = this.songQueue.queue
      .slice(0, 3)
      .map((song, i) => {
        const songName = song.trackInfo
          ? `${song.trackInfo.name} - ${song.trackInfo.artist}`
          : song.query;
        return `${i + 1}. ${songName} (${song.requestedBy})`;
      })
      .join(' | ');

    return `Queue (${this.songQueue.queue.length}/${this.songQueue.settings.maxQueueLength} songs): ${nextSongs}`;
  }

  async initialize() {
    try {
      await spotifyAuth.initialize();
      logger.info('Spotify integration initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Spotify integration:', error);
      throw error;
    }
  }

  cleanup() {
    spotifyAuth.cleanup();
  }
}

const spotify = new SpotifyManager();
export default spotify;
