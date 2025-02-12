import stringSimilarity from 'string-similarity';
import logger from './logger.js';
import fetch from 'node-fetch';

class MusicService {
  constructor() {
    this.cache = new Map();
    this.CACHE_TTL = 3600000; // 1 hour
    this.requestTimers = {
      musicbrainz: new Map(),
      spotify: new Map(),
    };
    this.rateLimits = {
      musicbrainz: 1000, // 1s between requests
      spotify: 100, // 100ms between requests
    };

    // Initialize request coalescing
    this.pendingRequests = new Map();

    // Common artist name variations
    this.artistVariations = new Map([
      ['lil', ['li1', "lil'", 'little', 'lil ', ' lil']],
      ['$', ['s', 'dollar', 'dollars', 'cash']],
      ['&', ['and', 'n', '+']],
      ['feat.', ['ft.', 'featuring', 'with', 'feat', 'ft']],
      ['xxxtentacion', ['xxx', 'tentacion', 'triple x', 'xxx tentacion']],
      ['a$ap', ['asap', 'a$ap', 'aap']],
      ['kid', ['kidd', 'kid ', ' kid', 'kyd']],
      ['young', ['yung', 'young ', ' young', 'yg']],
      ['yung', ['young', 'yng']],
      ['da', ['the', 'da ', ' da', 'thee']],
      ['dj', ['dj ', ' dj', 'deejay']],
      ['mc', ['mc ', ' mc', 'emcee']],
      ['2', ['two', 'to', 'too', '2k']],
      ['4', ['four', 'for', '4r']],
      ['1', ['one', 'won', 'juan']],
      ['3', ['three', 'tre', 'trey']],
      ['5', ['five', 'v']],
      ['6', ['six', 'vi']],
      ['7', ['seven', 'vii']],
      ['8', ['eight', 'viii']],
      ['9', ['nine', 'ix']],
      ['0', ['zero', 'o']],
      ['ice', ['icy', 'ic3']],
      ['boy', ['boi', 'boii']],
      ['girl', ['grl', 'grrl']],
      ['prince', ['prinz', 'prynce']],
      ['king', ['kng', 'kong']],
      ['queen', ['quen', 'kween']],
      ['black', ['blk', 'blak']],
      ['white', ['wht', 'whyte']],
      ['blue', ['blu', 'bloo']],
      ['red', ['rd', 'redd']],
      ['gold', ['gld', 'guld']],
      ['sir', ['sr', 'ser']],
      ['saint', ['st.', 'st', 'sant']],
      ['baby', ['bby', 'bb', 'babi']],
      ['lil baby', ['lilbaby', 'lil-baby']],
      ['dababy', ['da baby', 'da-baby']],
      ['travis scott', ['travisscott', 'travis-scott', 'la flame']],
      ['future', ['pluto', 'future hendrix']],
      ['drake', ['champagne papi', 'drizzy']],
      ['kanye', ['ye', 'yeezy']],
      ['jay-z', ['jayz', 'jay z', 'hova', 'hov']],
      ['eminem', ['slim shady', 'marshall mathers']],
      ['snoop dogg', ['snoop', 'snoop lion', 'snoopzilla']],
    ]);

    // Common word separators for artist/title
    this.titleArtistSeparators = [
      ' by ',
      ' - ',
      ' – ', // en dash
      ' — ', // em dash
      ' from ',
      ' performed by ',
      ' prod ',
      ' prod. ',
      ' produced by ',
      ' × ',
      ' x ',
      ' X ',
      ' vs ',
      ' vs. ',
      ' versus ',
      ' presents ',
      ' feat ',
      ' feat. ',
      ' featuring ',
      ' ft ',
      ' ft. ',
      ' with ',
      ' w/ ',
      ' & ',
      ' and ',
      ' + ',
      ' / ',
      ' // ',
      ' :: ',
      ' : ',
      ' | ',
      ' • ',
      ' · ',
      ' ~ ',
      ' >> ',
      ' -> ',
      ' => ',
    ];

    // Common title variations to normalize
    this.titleNormalizations = new Map([
      ['pt.', 'part'],
      ['pt ', 'part '],
      ['vol.', 'volume'],
      ['vol ', 'volume '],
      ['feat.', 'featuring'],
      ['ft.', 'featuring'],
      ['prod.', 'produced by'],
      ['explicit', ''],
      ['clean version', ''],
      ['album version', ''],
      ['original version', ''],
      ['radio edit', ''],
      ['bonus track', ''],
      ['deluxe', ''],
      ['remix', ''],
      ['live', ''],
    ]);

    // Common year patterns to extract
    this.yearPattern = /[\(\[\s](19|20)\d{2}[\)\]\s]/g;
  }

  async retryFetch(url, options, service, maxRetries = 3) {
    const lastRequest = this.requestTimers[service].get(url);
    if (lastRequest) {
      const timeSinceLastRequest = Date.now() - lastRequest;
      if (timeSinceLastRequest < this.rateLimits[service]) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.rateLimits[service] - timeSinceLastRequest)
        );
      }
    }

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
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }

  cleanTitle(title) {
    let cleaned = title.toLowerCase();

    // Remove year if present
    cleaned = cleaned.replace(this.yearPattern, ' ');

    // Apply title normalizations
    for (const [pattern, replacement] of this.titleNormalizations) {
      cleaned = cleaned.replace(new RegExp(pattern, 'gi'), replacement);
    }

    // Remove common parenthetical additions
    cleaned = cleaned
      .replace(/[(][^)]*[)]/g, '') // Remove anything in parentheses
      .replace(/[\[][^\]]*[\]]/g, '') // Remove anything in brackets
      .replace(/[{][^}]*[}]/g, '') // Remove anything in curly braces
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();

    return cleaned;
  }

  parseQueryIntoTitleAndArtist(originalQuery) {
    // First clean up the query
    const query = this.cleanTitle(originalQuery);

    // Try each separator
    for (const separator of this.titleArtistSeparators) {
      if (query.includes(separator)) {
        const [title, artist] = query.split(separator).map((part) => part.trim());
        if (title && artist) {
          return { title, artist };
        }
      }
    }

    // Try to match "Artist - Title" format
    const reverseMatch = query.match(/^(.+?)\s*[-–—]\s*(.+)$/);
    if (reverseMatch) {
      const [, artist, title] = reverseMatch;
      if (title && artist) {
        return { title, artist };
      }
    }

    // Try to extract known artist names
    const words = query.toLowerCase().split(/\s+/);
    for (let i = 0; i < words.length - 1; i++) {
      const possibleArtist = words.slice(i).join(' ');
      for (const [standard] of this.artistVariations.entries()) {
        if (possibleArtist.includes(standard)) {
          const title = words.slice(0, i).join(' ');
          if (title) {
            return { title, artist: possibleArtist };
          }
        }
      }
    }

    return { title: query, artist: '' };
  }

  normalizeArtistName(artist) {
    if (!artist) {
      return '';
    }
    let normalized = artist.toLowerCase().trim();

    // Apply artist name variations
    for (const [standard, variations] of this.artistVariations.entries()) {
      for (const variant of variations) {
        if (!variant) {
          continue;
        }
        try {
          const safePattern = new RegExp(
            `\\b${variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
            'gi'
          );
          normalized = normalized.replace(safePattern, standard);
        } catch (error) {
          logger.warn(`Invalid regex pattern for artist variant: ${variant}`, error);
          continue;
        }
      }
    }

    return normalized;
  }

  async searchMusicBrainz(query) {
    try {
      const { title, artist } = this.parseQueryIntoTitleAndArtist(query);
      let formattedQuery = this.cleanTitle(title);

      if (artist) {
        // Properly format artist query with quotes and escape special characters
        const normalizedArtist = this.normalizeArtistName(artist)
          .replace(/[^\w\s]/g, ' ') // Replace special chars with space
          .trim()
          .replace(/\s+/g, ' '); // Normalize spaces
        formattedQuery = `recording:"${formattedQuery}" AND artist:"${normalizedArtist}"`;
      } else {
        formattedQuery = `recording:"${formattedQuery}"`;
      }

      // Add advanced MusicBrainz search parameters
      const searchParams = new URLSearchParams({
        query: formattedQuery,
        fmt: 'json',
        limit: 10,
      });

      const searchUrl = `http://musicbrainz.org/ws/2/recording/?${searchParams.toString()}`;

      const data = await this.retryFetch(
        searchUrl,
        {
          headers: {
            'User-Agent': 'FirePigBot/1.0 (olen@latham.cloud)',
          },
        },
        'musicbrainz'
      );

      return (data.recordings || [])
        .filter((recording) => recording.score >= 50) // Filter out low-confidence matches
        .map((recording) => {
          const recordingArtist = recording['artist-credit']?.[0]?.name;
          const recordingTitle = recording.title;
          const artistName = recordingArtist ? this.normalizeArtistName(recordingArtist) : '';

          // Calculate a more accurate score based on multiple factors
          const baseScore = recording.score / 100;
          const hasArtist = recordingArtist ? 0.2 : 0;
          const hasReleases = recording.releases?.length > 0 ? 0.1 : 0;
          const isPopular = (recording.releases?.length || 0) > 5 ? 0.1 : 0;

          // Additional scoring factors
          const hasISRC = recording.isrcs?.length > 0 ? 0.1 : 0;
          const isOfficial = recording.releases?.some((r) => r.status === 'Official') ? 0.1 : 0;

          // Boost score if artist matches query
          const artistMatchBoost =
            artist && artistName.includes(this.normalizeArtistName(artist)) ? 0.3 : 0;

          return {
            title: recordingTitle,
            artist: artistName,
            score: Math.min(
              baseScore +
                hasArtist +
                hasReleases +
                isPopular +
                hasISRC +
                isOfficial +
                artistMatchBoost,
              1
            ),
            source: 'musicbrainz',
            raw: recording,
          };
        })
        .sort((a, b) => b.score - a.score);
    } catch (error) {
      logger.error('MusicBrainz search error:', error);
      return [];
    }
  }

  calculateMatchScore(result, normalizedQuery) {
    const { title: queryTitle, artist: queryArtist } =
      this.parseQueryIntoTitleAndArtist(normalizedQuery);
    const normalizedQueryArtist = this.normalizeArtistName(queryArtist);

    // Clean and normalize titles for comparison
    const cleanQueryTitle = this.cleanTitle(queryTitle);
    const cleanResultTitle = this.cleanTitle(result.title);

    // Calculate title similarity with improved thresholds
    const titleSimilarity = stringSimilarity.compareTwoStrings(cleanResultTitle, cleanQueryTitle);

    // Calculate artist similarity if query includes artist
    const artistSimilarity = normalizedQueryArtist
      ? stringSimilarity.compareTwoStrings(
          this.normalizeArtistName(result.artist),
          normalizedQueryArtist
        )
      : 1;

    // Enhanced weight factors
    const weights = {
      titleSimilarity: 0.35, // Reduced slightly to give more weight to other factors
      artistSimilarity: 0.35, // Reduced slightly to give more weight to other factors
      sourceConfidence: 0.15, // Increased to give more weight to reliable sources
      popularity: 0.15, // Increased to favor popular tracks
    };

    // Improved source confidence scoring
    const hasISRC = result.raw?.isrcs?.length > 0;
    const hasMultipleReleases = (result.raw?.releases?.length || 0) > 3;
    const sourceConfidence =
      {
        spotify: 1,
        musicbrainz: hasISRC ? 0.95 : hasMultipleReleases ? 0.85 : 0.75,
      }[result.source] || 0.5;

    // Enhanced popularity scoring
    let popularity = 0.5;
    if (result.raw?.popularity) {
      popularity = result.raw.popularity / 100;
    } else if ((result.raw?.releases?.length || 0) > 5) {
      popularity = 0.7;
    }

    // Improved exact match boosts
    const exactTitleMatch = cleanQueryTitle === cleanResultTitle ? 0.25 : 0;
    const exactArtistMatch =
      normalizedQueryArtist && this.normalizeArtistName(result.artist) === normalizedQueryArtist
        ? 0.25
        : 0;

    // Additional scoring factors
    const lengthSimilarityBoost =
      Math.abs(cleanQueryTitle.length - cleanResultTitle.length) < 3 ? 0.1 : 0;
    const wordCountSimilarityBoost =
      Math.abs(cleanQueryTitle.split(' ').length - cleanResultTitle.split(' ').length) < 2
        ? 0.1
        : 0;

    // Calculate final score with improved thresholds
    const score =
      titleSimilarity * weights.titleSimilarity +
      artistSimilarity * weights.artistSimilarity +
      sourceConfidence * weights.sourceConfidence +
      popularity * weights.popularity +
      exactTitleMatch +
      exactArtistMatch +
      lengthSimilarityBoost +
      wordCountSimilarityBoost;

    // Apply minimum threshold for better quality matches
    return score < 0.4 ? 0 : score;
  }

  findBestMatch(results, query) {
    const normalizedQuery = query.toLowerCase();
    let bestMatch = null;
    let highestScore = 0;
    const MINIMUM_SCORE_THRESHOLD = 0.45; // Increased minimum threshold

    for (const result of results) {
      const score = this.calculateMatchScore(result, normalizedQuery);
      if (score > highestScore && score >= MINIMUM_SCORE_THRESHOLD) {
        highestScore = score;
        bestMatch = result;
      }
    }

    return { match: bestMatch, confidence: highestScore };
  }

  async findSong(query, spotifySearchFn) {
    const cacheKey = query.toLowerCase();

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result;
    }

    // Check for pending requests (request coalescing)
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey);
    }

    // Create a new promise for this request
    const requestPromise = this._performSearch(query, spotifySearchFn);
    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;

      // Cache the result
      this.cache.set(cacheKey, {
        result,
        timestamp: Date.now(),
      });

      return result;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  async _performSearch(query, spotifySearchFn) {
    try {
      // Parse query once
      const { title, artist } = this.parseQueryIntoTitleAndArtist(query);
      const searchQuery = artist ? `${title} ${artist}` : query;

      // Search Spotify and MusicBrainz in parallel
      const [spotifyResult, musicbrainzResults] = await Promise.all([
        spotifySearchFn(searchQuery).catch(() => null),
        this.searchMusicBrainz(searchQuery),
      ]);

      // Combine all results
      const allResults = [
        ...(spotifyResult
          ? [
              {
                title: spotifyResult.name,
                artist: spotifyResult.artist,
                score: 1,
                source: 'spotify',
                raw: spotifyResult,
              },
            ]
          : []),
        ...musicbrainzResults,
      ];

      if (allResults.length === 0) {
        return { exists: false, confidence: 0, bestMatch: null };
      }

      // Find best match across all sources with improved threshold
      const { match, confidence } = this.findBestMatch(allResults, query);

      return {
        exists: confidence > 0.55, // Increased confidence threshold
        confidence,
        bestMatch: match,
        spotifyTrack: spotifyResult,
      };
    } catch (error) {
      logger.error('Music service search error:', error);
      return { exists: false, confidence: 0, bestMatch: null };
    }
  }
}

const musicService = new MusicService();
export default musicService;
