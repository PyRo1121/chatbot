import fetch from 'node-fetch';
import logger from './logger.js';
import stringSimilarity from 'string-similarity';

class MusicDatabase {
  constructor() {
    this.lastfmApiKey = process.env.LASTFM_API_KEY;
    this.cache = new Map();
    this.CACHE_TTL = 3600000; // 1 hour
    this.partialCache = new Map(); // For partial matches
    this.PARTIAL_CACHE_TTL = 1800000; // 30 minutes
    this.requestTimers = {
      musicbrainz: new Map(),
      lastfm: new Map(),
    };
    this.rateLimits = {
      musicbrainz: 1000, // 1 request per second
      lastfm: 250, // 4 requests per second
    };

    // Add filter patterns
    this.filterPatterns = {
      karaoke: [
        'karaoke',
        'instrumental',
        'backing track',
        'minus one',
        'originally performed by',
        'in the style of',
        'tribute to',
        'cover version',
        'made famous by',
        'as made popular by',
      ],
      covers: ['cover', 'remix', 'version', 'tribute', 'performed by', 'interpreted by'],
      troll: [
        'rick roll',
        'rick astley never gonna',
        'baby shark',
        'nyan cat',
        'epic sax guy',
        'sandstorm darude',
        'john cena theme',
        'meme song',
      ],
      lowQuality: ['8 bit', 'midi version', 'ringtone', 'sound effect', 'sfx', 'parody'],
    };

    // Known legitimate cover artists to allow
    this.allowedCoverArtists = new Set([
      'vitamin string quartet',
      'punk goes pop',
      'kidz bop kids', // Some streams might want these
      // Add more as needed
    ]);

    // Add better caching with LRU (Least Recently Used) implementation
    this.maxCacheSize = 1000;
    this.cacheHits = 0;
    this.cacheMisses = 0;

    // Add popular artist variations map
    this.artistVariations = new Map([
      ['lil', ['li1', "lil'", 'little']],
      ['$', ['s', 'dollar']],
      ['&', ['and', 'n']],
      ['feat.', ['ft.', 'featuring', 'with']],
      // Add more common variations
    ]);

    // Fix regex-safe title variations
    this.titleVariations = new Map([
      ['fuck', ['fk', 'fu', 'f\\*ck', 'f\\*\\*k', 'fck']], // Escape asterisks
      ['shit', ['sh\\*t', 'sh\\!t', 'sht']], // Escape special characters
      ['fucking', ['fuckin', 'fking', 'fn']],
      // Add more variations
    ]);

    // Initialize metrics
    this.metrics = {
      totalSearches: 0,
      successfulMatches: 0,
      cacheHits: 0,
      apiErrors: 0,
      lastReset: Date.now(),
    };
  }

  async retryFetch(url, options, service, maxRetries = 3) {
    // Check rate limiting
    const lastRequest = this.requestTimers[service].get(url);
    if (lastRequest) {
      const timeSinceLastRequest = Date.now() - lastRequest;
      if (timeSinceLastRequest < this.rateLimits[service]) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.rateLimits[service] - timeSinceLastRequest)
        );
      }
    }

    /* eslint-disable no-await-in-loop */
    for (let i = 0; i < maxRetries; i++) {
      try {
        this.requestTimers[service].set(url, Date.now());
        const response = await fetch(url, options);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        if (i === maxRetries - 1) {
          throw error;
        }
        // Wait before next retry
        const delay = Math.pow(2, i) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  normalizeTitle(title) {
    let normalized = title
      .toLowerCase()
      .replace(/['"]/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/feat\.?|ft\.?/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Apply title variations with escaped regex
    for (const [standard, variations] of this.titleVariations.entries()) {
      for (const variant of variations) {
        try {
          const safePattern = new RegExp(variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          normalized = normalized.replace(safePattern, standard);
        } catch (error) {
          logger.warn(`Invalid regex pattern for variant: ${variant}`, error);
          continue;
        }
      }
    }

    return normalized;
  }

  normalizeArtistName(artist) {
    let normalized = artist.toLowerCase().trim();

    // Apply artist name variations
    for (const [standard, variations] of this.artistVariations.entries()) {
      for (const variant of variations) {
        normalized = normalized.replace(new RegExp(`\\b${variant}\\b`, 'gi'), standard);
      }
    }

    return normalized;
  }

  isUnwantedVersion(title, artist) {
    const fullString = `${title} ${artist}`.toLowerCase();

    // Check if it's an allowed cover artist
    if (this.allowedCoverArtists.has(artist?.toLowerCase())) {
      return false;
    }

    // Check all filter patterns
    for (const [type, patterns] of Object.entries(this.filterPatterns)) {
      for (const pattern of patterns) {
        if (fullString.includes(pattern)) {
          logger.debug(`Filtered ${type} song: ${fullString} (matched: ${pattern})`);
          return true;
        }
      }
    }

    return false;
  }

  async searchMusicBrainz(query) {
    try {
      const data = await this.retryFetch(
        `http://musicbrainz.org/ws/2/recording/?query=${encodeURIComponent(query)}&fmt=json`,
        {
          headers: {
            'User-Agent': 'FirePigBot/1.0 (olen@latham.cloud)',
          },
        },
        'musicbrainz'
      );

      // Filter and process results
      return (data.recordings || [])
        .filter(
          (recording) =>
            !this.isUnwantedVersion(recording.title, recording['artist-credit']?.[0]?.name)
        )
        .map((recording) => ({
          title: this.normalizeTitle(recording.title),
          artist: recording['artist-credit']?.[0]?.name,
          score: recording.score / 100,
          source: 'musicbrainz',
          raw: recording,
        }));
    } catch (error) {
      logger.error('MusicBrainz search error:', error);
      return [];
    }
  }

  async searchLastFM(query) {
    if (!this.lastfmApiKey) {
      return [];
    }

    try {
      const data = await this.retryFetch(
        `http://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(query)}&api_key=${this.lastfmApiKey}&format=json`,
        {},
        'lastfm'
      );

      // Filter and process results
      return (data.results?.trackmatches?.track || [])
        .filter((track) => !this.isUnwantedVersion(track.name, track.artist))
        .map((track) => ({
          title: this.normalizeTitle(track.name),
          artist: track.artist,
          score: track.listeners ? Math.min(track.listeners / 100000, 1) : 0.5,
          source: 'lastfm',
          raw: track,
        }));
    } catch (error) {
      logger.error('Last.fm search error:', error);
      return [];
    }
  }

  findBestMatch(results, query) {
    const normalizedQuery = this.normalizeTitle(query);
    let bestMatch = null;
    let highestScore = 0;

    for (const result of results) {
      // Skip unwanted versions one more time (in case they slipped through)
      if (this.isUnwantedVersion(result.title, result.artist)) {
        continue;
      }

      const fullString = `${result.title} ${result.artist}`;
      const similarity = stringSimilarity.compareTwoStrings(
        this.normalizeTitle(fullString),
        normalizedQuery
      );

      // Combine similarity with source confidence
      const finalScore = similarity * 0.7 + result.score * 0.3;

      if (finalScore > highestScore) {
        highestScore = finalScore;
        bestMatch = result;
      }
    }

    return { match: bestMatch, confidence: highestScore };
  }

  async findSong(query) {
    this.metrics.totalSearches++;
    const cacheKey = query.toLowerCase();

    // Try cache with variations
    const normalizedQuery = this.normalizeTitle(query);
    const cacheResult = this.checkCache(normalizedQuery);
    if (cacheResult) {
      this.metrics.cacheHits++;
      return cacheResult;
    }

    try {
      // Add request coalescing - combine identical requests within a short window
      const pendingKey = `pending_${normalizedQuery}`;
      if (this.cache.has(pendingKey)) {
        return await this.cache.get(pendingKey);
      }

      // Create promise for this request
      const resultPromise = this.performSearch(query);
      this.cache.set(pendingKey, resultPromise);

      const result = await resultPromise;
      this.cache.delete(pendingKey);

      if (result.exists) {
        this.metrics.successfulMatches++;
      }

      return result;
    } catch (error) {
      this.metrics.apiErrors++;
      throw error;
    }
  }

  async performSearch(query) {
    const cacheKey = query.toLowerCase();

    // Check main cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.result;
      }
    }

    // Check partial cache
    const partialMatch = Array.from(this.partialCache.entries()).find(([key, data]) => {
      if (Date.now() - data.timestamp > this.PARTIAL_CACHE_TTL) {
        return false;
      }
      return stringSimilarity.compareTwoStrings(key, cacheKey) > 0.8;
    });

    if (partialMatch) {
      return partialMatch[1].result;
    }

    try {
      // Search both services in parallel with timeout
      const results = await Promise.race([
        Promise.all([this.searchMusicBrainz(query), this.searchLastFM(query)]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Search timeout')), 5000)),
      ]).catch((error) => {
        logger.warn('Search timeout or error:', error);
        return [[], []]; // Return empty results on timeout
      });

      // Combine all results
      const allResults = [...results[0], ...results[1]];

      if (allResults.length === 0) {
        const nullResult = { exists: false, confidence: 0, bestMatch: null };
        this.cache.set(cacheKey, { result: nullResult, timestamp: Date.now() });
        return nullResult;
      }

      // Find best match
      const { match, confidence } = this.findBestMatch(allResults, query);

      const result = {
        exists: confidence > 0.5,
        confidence,
        bestMatch: match,
        artist: match?.artist || null,
        title: match?.title || null,
      };

      // Cache the result
      this.cache.set(cacheKey, { result, timestamp: Date.now() });

      // Add to partial cache if good match
      if (confidence > 0.7) {
        this.partialCache.set(cacheKey, { result, timestamp: Date.now() });
      }

      return result;
    } catch (error) {
      logger.error('Music database search error:', error);
      return { exists: false, confidence: 0, bestMatch: null };
    }
  }

  checkCache(query) {
    // Check exact match
    if (this.cache.has(query)) {
      const cached = this.cache.get(query);
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.result;
      }
    }

    // Check variations
    const variations = this.generateQueryVariations(query);
    for (const variation of variations) {
      if (this.cache.has(variation)) {
        const cached = this.cache.get(variation);
        if (Date.now() - cached.timestamp < this.CACHE_TTL) {
          // Cache the original query too
          this.cache.set(query, {
            result: cached.result,
            timestamp: Date.now(),
          });
          return cached.result;
        }
      }
    }

    return null;
  }

  generateQueryVariations(query) {
    const variations = new Set();
    const parts = query.split(/\s+/);

    // Generate common variations
    variations.add(query.replace(/[^\w\s]/g, '')); // Remove special chars
    variations.add(parts.join('')); // Remove spaces

    // Try with and without 'by' or '-'
    if (query.includes(' by ')) {
      variations.add(query.replace(' by ', ' - '));
    }
    if (query.includes(' - ')) {
      variations.add(query.replace(' - ', ' by '));
    }

    return variations;
  }

  clearOldCache() {
    const now = Date.now();

    // Clear main cache
    for (const [key, data] of this.cache.entries()) {
      if (now - data.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }

    // Clear partial cache
    for (const [key, data] of this.partialCache.entries()) {
      if (now - data.timestamp > this.PARTIAL_CACHE_TTL) {
        this.partialCache.delete(key);
      }
    }
  }

  trimCache() {
    if (this.cache.size > this.maxCacheSize) {
      // Sort by timestamp and remove oldest entries
      const entries = Array.from(this.cache.entries()).sort(
        ([, a], [, b]) => b.timestamp - a.timestamp
      );

      const entriesToKeep = entries.slice(0, this.maxCacheSize);
      this.cache = new Map(entriesToKeep);
    }
  }

  getMetrics() {
    const now = Date.now();
    const timeWindow = (now - this.metrics.lastReset) / 1000; // in seconds

    return {
      ...this.metrics,
      searchesPerSecond: this.metrics.totalSearches / timeWindow,
      cacheHitRate: this.metrics.cacheHits / this.metrics.totalSearches,
      successRate: this.metrics.successfulMatches / this.metrics.totalSearches,
      errorRate: this.metrics.apiErrors / this.metrics.totalSearches,
      timeWindowSeconds: timeWindow,
    };
  }

  resetMetrics() {
    this.metrics = {
      totalSearches: 0,
      successfulMatches: 0,
      cacheHits: 0,
      apiErrors: 0,
      lastReset: Date.now(),
    };
  }
}

const musicDb = new MusicDatabase();

// Periodically clean up old cache entries
setInterval(() => {
  musicDb.trimCache();
  musicDb.clearOldCache();
}, 300000); // Every 5 minutes

setInterval(() => {
  musicDb.resetMetrics();
}, 3600000); // Reset metrics hourly

export default musicDb;
