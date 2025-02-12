import { Index } from 'flexsearch';
import logger from './logger.js';

class FlexSearchManager {
  constructor() {
    this.index = new Index({
      preset: 'performance',
      tokenize: 'full',
      language: 'en',
      context: true,
      cache: true,
    });

    this.docs = new Map();
    this.stats = {
      totalSearches: 0,
      cacheHits: 0,
      exactMatches: 0,
      fuzzyMatches: 0,
    };
  }

  addDocument(id, content, metadata = {}) {
    try {
      // Add to search index
      this.index.add(id, content);

      // Store full document data
      this.docs.set(id, {
        id,
        content,
        metadata,
        timestamp: Date.now(),
      });
      return true;
    } catch (error) {
      logger.error('Error adding document to FlexSearch:', error);
      return false;
    }
  }

  search(query, options = {}) {
    this.stats.totalSearches++;
    const { limit = 5, threshold = 0.3, context = false } = options;

    try {
      // Try exact match first
      const exactMatches = this.index.search(query, {
        limit,
        suggest: false,
        context,
      });

      if (exactMatches.length > 0) {
        this.stats.exactMatches++;
        return exactMatches.map((id) => this.docs.get(id));
      }

      // Try fuzzy search
      const fuzzyMatches = this.index.search(query, {
        limit,
        suggest: true,
        context,
      });

      if (fuzzyMatches.length > 0) {
        this.stats.fuzzyMatches++;
        return fuzzyMatches.map((id) => this.docs.get(id));
      }

      return [];
    } catch (error) {
      logger.error('Error searching FlexSearch:', error);
      return [];
    }
  }

  getStats() {
    return {
      ...this.stats,
      documentsIndexed: this.docs.size,
      memoryUsage: process.memoryUsage().heapUsed,
    };
  }

  clear() {
    this.index.clear();
    this.docs.clear();
    this.stats = {
      totalSearches: 0,
      cacheHits: 0,
      exactMatches: 0,
      fuzzyMatches: 0,
    };
  }
}

const flexSearch = new FlexSearchManager();
export default flexSearch;
