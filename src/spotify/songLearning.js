import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import logger from '../utils/logger.js';
import { generateResponse } from '../utils/perplexity.js';

class SongLearning {
  constructor() {
    this.learningData = this.loadLearningData();
    this.initializePatterns();
  }

  loadLearningData() {
    try {
      const data = readFileSync(
        join(process.cwd(), 'src/spotify/song_learning.json'),
        'utf8'
      );
      const parsed = JSON.parse(data);

      // Ensure all required properties exist
      return {
        songPatterns: parsed.songPatterns || {},
        userPreferences: parsed.userPreferences || {},
        approvedSongs: parsed.approvedSongs || {},
        rejectedSongs: parsed.rejectedSongs || {},
        karaokePatterns: parsed.karaokePatterns || [],
        trollPatterns: parsed.trollPatterns || [],
        lastUpdated: parsed.lastUpdated || new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Error loading song learning data:', error);
      return {
        songPatterns: {},
        userPreferences: {},
        approvedSongs: {},
        rejectedSongs: {},
        karaokePatterns: [],
        trollPatterns: [],
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  saveLearningData() {
    try {
      this.learningData.lastUpdated = new Date().toISOString();
      writeFileSync(
        join(process.cwd(), 'src/spotify/song_learning.json'),
        JSON.stringify(this.learningData, null, 2)
      );
    } catch (error) {
      logger.error('Error saving song learning data:', error);
    }
  }

  initializePatterns() {
    // Preserve existing patterns and add any missing ones
    const defaultKaraokePatterns = [
      'karaoke version',
      'instrumental version',
      'backing track',
      'originally performed by',
      'in the style of',
      'tribute to',
      'cover version',
      'made famous by',
      'as made popular by',
      'remix backing track',
      'instrumental cover',
      'sing-along version',
      'without vocals',
      'minus one',
      'backing track',
      'instrumental only',
    ];

    const defaultTrollPatterns = [
      'rick roll',
      'rick astley never gonna',
      'baby shark',
      'nyan cat',
      'troll song',
      'meme song',
      'epic sax guy',
      'sandstorm darude',
      'john cena theme',
      'rickroll',
    ];

    // Merge existing patterns with defaults
    this.learningData.karaokePatterns = Array.from(
      new Set([
        ...defaultKaraokePatterns,
        ...(this.learningData.karaokePatterns || []),
      ])
    );

    this.learningData.trollPatterns = Array.from(
      new Set([
        ...defaultTrollPatterns,
        ...(this.learningData.trollPatterns || []),
      ])
    );

    this.saveLearningData();
  }

  async learnFromRequest(query, username, trackInfo = null) {
    try {
      // Normalize query
      const normalizedQuery = query.toLowerCase();
      const songKey = trackInfo
        ? `${trackInfo.name}|${trackInfo.artist}`.toLowerCase()
        : normalizedQuery;

      // Update song patterns
      this.learningData.songPatterns[songKey] =
        (this.learningData.songPatterns[songKey] || 0) + 1;

      // Add to approved songs if it's a valid track
      if (trackInfo) {
        this.learningData.approvedSongs[songKey] =
          (this.learningData.approvedSongs[songKey] || 0) + 1;
      }

      // Update user preferences
      if (!this.learningData.userPreferences[username]) {
        this.learningData.userPreferences[username] = {
          requestedSongs: [],
          genres: {},
          artists: {},
          lastRequest: null,
        };
      }

      const userPrefs = this.learningData.userPreferences[username];
      userPrefs.requestedSongs.push({
        query: songKey,
        trackInfo,
        timestamp: Date.now(),
      });

      // Keep only last 50 requests
      if (userPrefs.requestedSongs.length > 50) {
        userPrefs.requestedSongs = userPrefs.requestedSongs.slice(-50);
      }

      userPrefs.lastRequest = Date.now();

      // Update artist stats
      if (trackInfo) {
        const artist = trackInfo.artist.toLowerCase();
        userPrefs.artists[artist] = (userPrefs.artists[artist] || 0) + 1;
      } else {
        // Try to extract artist from query
        const songParts = normalizedQuery
          .split(' - ')
          .map((part) => part.trim());
        if (songParts.length > 1) {
          const artist = songParts[1];
          userPrefs.artists[artist] = (userPrefs.artists[artist] || 0) + 1;
        }
      }

      // Save after every request to ensure accurate tracking
      this.saveLearningData();
    } catch (error) {
      logger.error('Error learning from request:', error);
    }
  }

  async generateRecommendation(username) {
    try {
      const userPrefs = this.learningData.userPreferences[username];
      if (!userPrefs || userPrefs.requestedSongs.length === 0) {
        return null;
      }

      const recentSongs = userPrefs.requestedSongs
        .slice(-5)
        .map((s) =>
          s.trackInfo ? `${s.trackInfo.name} - ${s.trackInfo.artist}` : s.query
        );

      const topArtists = Object.entries(userPrefs.artists)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([artist]) => artist);

      const prompt = `Based on this user's song request history, suggest a song they might like:
      Recent Requests: ${recentSongs.join(', ')}
      Favorite Artists: ${topArtists.join(', ')}
      
      Respond with just the song name and artist, e.g. "Song Name - Artist"`;

      const recommendation = await generateResponse(prompt);
      return recommendation;
    } catch (error) {
      logger.error('Error generating recommendation:', error);
      return null;
    }
  }

  isKaraokeVersion(query) {
    return this.learningData.karaokePatterns.some((pattern) =>
      query.toLowerCase().includes(pattern)
    );
  }

  isTrollSong(query) {
    return this.learningData.trollPatterns.some((pattern) =>
      query.toLowerCase().includes(pattern)
    );
  }

  addRejectedSong(query, reason) {
    const key = query.toLowerCase();
    if (!this.learningData.rejectedSongs[key]) {
      this.learningData.rejectedSongs[key] = {
        count: 0,
        reasons: {},
      };
    }

    this.learningData.rejectedSongs[key].count++;
    this.learningData.rejectedSongs[key].reasons[reason] =
      (this.learningData.rejectedSongs[key].reasons[reason] || 0) + 1;

    this.saveLearningData();
  }

  getSongStats() {
    const approvedTotal = Object.values(this.learningData.approvedSongs).reduce(
      (sum, count) => sum + count,
      0
    );
    const rejectedTotal = Object.values(this.learningData.rejectedSongs).reduce(
      (sum, data) => sum + data.count,
      0
    );

    const topApproved = Object.entries(this.learningData.approvedSongs)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([song, count]) => ({ song, count }));

    const topRejected = Object.entries(this.learningData.rejectedSongs)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([song, data]) => ({
        song,
        count: data.count,
        reasons: data.reasons,
      }));

    return {
      totalRequests: approvedTotal + rejectedTotal,
      approvedSongs: {
        total: approvedTotal,
        unique: Object.keys(this.learningData.approvedSongs).length,
        top: topApproved,
      },
      rejectedSongs: {
        total: rejectedTotal,
        unique: Object.keys(this.learningData.rejectedSongs).length,
        top: topRejected,
      },
      lastUpdated: this.learningData.lastUpdated,
    };
  }
}

const songLearning = new SongLearning();
export default songLearning;
