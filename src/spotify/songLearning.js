import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import logger from '../utils/logger.js';

class SongLearning {
  constructor() {
    this.dbPath = join(process.cwd(), 'src/spotify/song_learning.json');
    this.data = this.loadData();
  }

  loadData() {
    try {
      if (existsSync(this.dbPath)) {
        const data = readFileSync(this.dbPath, 'utf8');
        return JSON.parse(data);
      }
      // Initialize with default structure
      const defaultData = {
        approvedSongs: {}, // Track successful song requests
        rejectedSongs: {}, // Track rejected songs
        karaokePatterns: [
          // Common patterns for karaoke versions
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
        ],
        trollPatterns: [
          // Known troll song patterns
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
        ],
      };
      this.saveData(defaultData);
      return defaultData;
    } catch (error) {
      logger.error('Error loading song learning data:', error);
      return {
        approvedSongs: {},
        rejectedSongs: {},
        karaokePatterns: [],
        trollPatterns: [],
      };
    }
  }

  saveData(data = this.data) {
    try {
      writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error('Error saving song learning data:', error);
    }
  }

  // Record a successful song request
  recordApprovedSong(songName, artistName) {
    const key = `${songName.toLowerCase()}|${artistName.toLowerCase()}`;
    this.data.approvedSongs[key] = (this.data.approvedSongs[key] || 0) + 1;
    this.saveData();
  }

  // Record a rejected song
  recordRejectedSong(songName, artistName, reason) {
    const key = `${songName.toLowerCase()}|${artistName.toLowerCase()}`;
    if (!this.data.rejectedSongs[key]) {
      this.data.rejectedSongs[key] = {
        count: 0,
        reasons: {},
      };
    }
    this.data.rejectedSongs[key].count++;
    this.data.rejectedSongs[key].reasons[reason] =
      (this.data.rejectedSongs[key].reasons[reason] || 0) + 1;
    this.saveData();
  }

  // Check if a song is likely to be a karaoke version
  isLikelyKaraoke(trackName, artistName, albumName) {
    const textToCheck = `${trackName} ${artistName} ${albumName}`.toLowerCase();

    // Check against known karaoke patterns
    for (const pattern of this.data.karaokePatterns) {
      if (textToCheck.includes(pattern.toLowerCase())) {
        return true;
      }
    }

    // Check for suspicious artist names
    const artistNameLower = artistName.toLowerCase();
    if (
      artistNameLower.includes('karaoke') ||
      artistNameLower.includes('tribute') ||
      artistNameLower.includes('studio band') ||
      artistNameLower.includes('cover band') ||
      artistNameLower.includes('performed by')
    ) {
      return true;
    }

    return false;
  }

  // Check if a song is likely to be a troll song based on learning data
  isLikelyTrollSong(songName, artistName) {
    const key = `${songName.toLowerCase()}|${artistName.toLowerCase()}`;
    const textToCheck = `${songName} ${artistName}`.toLowerCase();

    // Check against known troll patterns
    for (const pattern of this.data.trollPatterns) {
      if (textToCheck.includes(pattern.toLowerCase())) {
        return true;
      }
    }

    // Check rejection history
    if (this.data.rejectedSongs[key]) {
      const rejectionCount = this.data.rejectedSongs[key].count;
      const approvalCount = this.data.approvedSongs[key] || 0;

      // If a song has been rejected multiple times more than approved
      if (rejectionCount > approvalCount * 2 && rejectionCount > 3) {
        return true;
      }
    }

    return false;
  }

  // Get song status based on learning data
  getSongStatus(songName, artistName) {
    const key = `${songName.toLowerCase()}|${artistName.toLowerCase()}`;
    return {
      approvalCount: this.data.approvedSongs[key] || 0,
      rejections: this.data.rejectedSongs[key] || null,
    };
  }
}

const songLearning = new SongLearning();
export default songLearning;
