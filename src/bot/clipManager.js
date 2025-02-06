import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import logger from '../utils/logger.js';
import { generateResponse } from '../utils/deepseek.js';

class ClipManager {
  constructor() {
    this.clipsData = this.loadClipsData();
    this.initializeData();
  }

  loadClipsData() {
    try {
      const data = readFileSync(join(process.cwd(), 'src/bot/clips_data.json'), 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error('Error loading clips data:', error);
      return {
        clips: [],
        highlights: [],
        categories: {},
        tags: {},
        stats: {
          totalClips: 0,
          totalViews: 0,
          lastUpdated: new Date().toISOString(),
        },
      };
    }
  }

  saveClipsData() {
    try {
      writeFileSync(
        join(process.cwd(), 'src/bot/clips_data.json'),
        JSON.stringify(this.clipsData, null, 2)
      );
    } catch (error) {
      logger.error('Error saving clips data:', error);
    }
  }

  initializeData() {
    if (!this.clipsData.clips) {
      this.clipsData.clips = [];
    }
    if (!this.clipsData.highlights) {
      this.clipsData.highlights = [];
    }
    if (!this.clipsData.categories) {
      this.clipsData.categories = {};
    }
    if (!this.clipsData.tags) {
      this.clipsData.tags = {};
    }
    if (!this.clipsData.stats) {
      this.clipsData.stats = {
        totalClips: 0,
        totalViews: 0,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  async addClip(clip) {
    try {
      this.clipsData.clips.push(clip);
      this.clipsData.stats.totalClips++;

      // Update categories
      if (clip.game) {
        this.clipsData.categories[clip.game] = (this.clipsData.categories[clip.game] || 0) + 1;
      }

      // Extract and update tags
      const tags = await this.extractTags(clip.title);
      tags.forEach((tag) => {
        this.clipsData.tags[tag] = (this.clipsData.tags[tag] || 0) + 1;
      });

      this.saveClipsData();
      return true;
    } catch (error) {
      logger.error('Error adding clip:', error);
      return false;
    }
  }

  async extractTags(title) {
    try {
      const prompt = `Extract relevant tags from this Twitch clip title: "${title}"
      Return only the tags as a comma-separated list, max 5 tags.
      Example: "funny,highlight,gameplay"`;

      const response = await generateResponse(prompt);
      return response ? response.split(',').map((tag) => tag.trim().toLowerCase()) : [];
    } catch (error) {
      logger.error('Error extracting tags:', error);
      return [];
    }
  }

  async getClipsByCategory(category) {
    return this.clipsData.clips.filter(
      (clip) => clip.game && clip.game.toLowerCase() === category.toLowerCase()
    );
  }

  async getClipsByTag(tag) {
    const normalizedTag = tag.toLowerCase();
    const results = [];
    for (const clip of this.clipsData.clips) {
      const tags = await this.extractTags(clip.title);
      if (tags.includes(normalizedTag)) {
        results.push(clip);
      }
    }
    return results;
  }

  async getRecentClips(days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return this.clipsData.clips.filter((clip) => new Date(clip.timestamp) > cutoff);
  }

  async getTopClips(limit = 10) {
    return this.clipsData.clips.sort((a, b) => b.views - a.views).slice(0, limit);
  }

  async getHighlights(days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return this.clipsData.highlights.filter((highlight) => new Date(highlight.timestamp) > cutoff);
  }

  getClipById(clipId) {
    return this.clipsData.clips.find((clip) => clip.id === clipId);
  }

  async updateClipViews(clipId, views) {
    const clip = this.getClipById(clipId);
    if (clip) {
      const viewDiff = views - clip.views;
      clip.views = views;
      this.clipsData.stats.totalViews += viewDiff;
      this.saveClipsData();
      return true;
    }
    return false;
  }

  getStats() {
    const stats = {
      totalClips: this.clipsData.stats.totalClips,
      totalViews: this.clipsData.stats.totalViews,
      uniqueCategories: Object.keys(this.clipsData.categories).length,
      topCategory: Object.entries(this.clipsData.categories)
        .sort(([, a], [, b]) => b - a)
        .map(([category]) => category)[0],
      popularTags: Object.entries(this.clipsData.tags)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([tag, count]) => `${tag}(${count})`),
    };

    return stats;
  }

  async cleanup() {
    try {
      // Keep only last 30 days of clips
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      this.clipsData.clips = this.clipsData.clips.filter(
        (clip) => new Date(clip.timestamp) > thirtyDaysAgo
      );

      this.clipsData.highlights = this.clipsData.highlights.filter(
        (highlight) => new Date(highlight.timestamp) > thirtyDaysAgo
      );

      // Recalculate stats
      this.clipsData.stats.totalClips = this.clipsData.clips.length;
      this.clipsData.stats.totalViews = this.clipsData.clips.reduce(
        (sum, clip) => sum + clip.views,
        0
      );
      this.clipsData.stats.lastUpdated = new Date().toISOString();

      // Reset and recalculate categories and tags
      this.clipsData.categories = {};
      this.clipsData.tags = {};

      // Process clips synchronously first
      for (const clip of this.clipsData.clips) {
        if (clip.game) {
          this.clipsData.categories[clip.game] = (this.clipsData.categories[clip.game] || 0) + 1;
        }
      }

      // Then process tags asynchronously
      for (const clip of this.clipsData.clips) {
        const tags = await this.extractTags(clip.title);
        for (const tag of tags) {
          this.clipsData.tags[tag] = (this.clipsData.tags[tag] || 0) + 1;
        }
      }

      this.saveClipsData();
      logger.info('Clips data cleaned up');
      return true;
    } catch (error) {
      logger.error('Error cleaning up clips data:', error);
      return false;
    }
  }
}

const clipManager = new ClipManager();
export default clipManager;
