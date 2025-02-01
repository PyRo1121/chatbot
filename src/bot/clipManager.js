<<<<<<< HEAD
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import logger from '../utils/logger.js';
import { generateResponse } from '../utils/openai.js';
import { ApiClient } from '@twurple/api';
import { RefreshingAuthProvider } from '@twurple/auth';
import tokenManager from '../auth/tokenManager.js';

class ClipManager {
  constructor() {
    this.dbPath = join(process.cwd(), 'src/bot/clips_data.json');
    this.data = this.loadData();
    this.CLIP_RETENTION = 30 * 24 * 60 * 60 * 1000; // 30 days
  }

  loadData() {
    try {
      if (existsSync(this.dbPath)) {
        const data = readFileSync(this.dbPath, 'utf8');
        return JSON.parse(data);
      }
      const defaultData = {
        clips: [],
        categories: {},
        tags: {},
        highlights: [],
        compilations: [],
      };
      this.saveData(defaultData);
      return defaultData;
    } catch (error) {
      logger.error('Error loading clips data:', error);
      return {
        clips: [],
        categories: {},
        tags: {},
        highlights: [],
        compilations: [],
      };
    }
  }

  saveData(data = this.data) {
    try {
      writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error('Error saving clips data:', error);
    }
  }

  async createClip(title, creator) {
    try {
      const tokens = await tokenManager.getBroadcasterTokens();
      const authProvider = new RefreshingAuthProvider({
        clientId: tokens.clientId,
        clientSecret: tokens.clientSecret,
        onRefresh: async (userId, newTokenData) => {
          await tokenManager.updateBroadcasterTokens(newTokenData);
        },
      });

      await authProvider.addUserForToken({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 0,
        obtainmentTimestamp: 0,
      });

      const apiClient = new ApiClient({ authProvider });
      const clip = await apiClient.clips.createClip({ channel: tokens.userId });

      if (clip) {
        // Get clip details
        const clipData = await apiClient.clips.getClipById(clip.id);

        // Generate tags and category using AI
        const analysisPrompt = `Analyze this clip title and creator's name to suggest relevant tags and a category.
Title: "${title}"
Creator: ${creator}

Respond with JSON only:
{
  "tags": ["array of 3-5 relevant tags"],
  "category": "string (one of: Funny, Skillful, Informative, Highlight, Reaction, Social)"
}`;

        const analysis = JSON.parse(await generateResponse(analysisPrompt));

        const clipInfo = {
          id: clip.id,
          url: clipData.url,
          title,
          creator,
          timestamp: new Date().toISOString(),
          views: 0,
          category: analysis.category,
          tags: analysis.tags,
          reactions: {
            likes: 0,
            shares: 0,
          },
        };

        // Update data structures
        this.data.clips.push(clipInfo);

        // Update category stats
        if (!this.data.categories[analysis.category]) {
          this.data.categories[analysis.category] = [];
        }
        this.data.categories[analysis.category].push(clip.id);

        // Update tag stats
        analysis.tags.forEach((tag) => {
          if (!this.data.tags[tag]) {
            this.data.tags[tag] = [];
          }
          this.data.tags[tag].push(clip.id);
        });

        this.saveData();
        return clipInfo;
      }
    } catch (error) {
      logger.error('Error creating clip:', error);
    }
    return null;
  }

  async suggestCompilation() {
    try {
      const recentClips = this.data.clips
        .filter((clip) => {
          const clipDate = new Date(clip.timestamp);
          return Date.now() - clipDate.getTime() <= this.CLIP_RETENTION;
        })
        .sort((a, b) => b.reactions.likes - a.reactions.likes);

      if (recentClips.length < 3) {
        return null;
      }

      const prompt = `Analyze these clips and suggest a compilation theme:
Clips: ${JSON.stringify(recentClips.slice(0, 10))}

Respond with JSON only:
{
  "theme": "string (compilation theme/title)",
  "description": "string (brief description)",
  "selectedClips": ["array of clip IDs to include"],
  "order": ["array of clip IDs in suggested order"],
  "transitions": ["array of transition suggestions between clips"]
}`;

      const suggestion = JSON.parse(await generateResponse(prompt));

      const compilation = {
        id: Date.now().toString(),
        ...suggestion,
        timestamp: new Date().toISOString(),
        status: 'suggested',
      };

      this.data.compilations.push(compilation);
      this.saveData();

      return compilation;
    } catch (error) {
      logger.error('Error suggesting compilation:', error);
      return null;
    }
  }

  getClipsByCategory(category) {
    return this.data.categories[category] || [];
  }

  getClipsByTag(tag) {
    return this.data.tags[tag] || [];
  }

  getRecentClips(days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return this.data.clips
      .filter((clip) => new Date(clip.timestamp) > cutoff)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  getTopClips(limit = 10) {
    return this.data.clips.sort((a, b) => b.reactions.likes - a.reactions.likes).slice(0, limit);
  }

  async analyzeClipPerformance(clipId) {
    const clip = this.data.clips.find((c) => c.id === clipId);
    if (!clip) {
      return null;
    }

    try {
      const prompt = `Analyze this clip's performance:
Clip Data: ${JSON.stringify(clip)}

Respond with JSON only:
{
  "performance": "string (excellent/good/fair/poor)",
  "insights": ["array of performance insights"],
  "recommendations": ["array of improvement suggestions"],
  "similarSuccessful": ["array of similar successful clip IDs"]
}`;

      return JSON.parse(await generateResponse(prompt));
    } catch (error) {
      logger.error('Error analyzing clip performance:', error);
      return null;
    }
  }

  getClipStats() {
    const totalClips = this.data.clips.length;
    const categoryDistribution = Object.fromEntries(
      Object.entries(this.data.categories).map(([cat, clips]) => [cat, clips.length])
    );
    const popularTags = Object.entries(this.data.tags)
      .map(([tag, clips]) => ({ tag, count: clips.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalClips,
      categoryDistribution,
      popularTags,
      recentClips: this.getRecentClips(7).length,
      compilations: this.data.compilations.length,
    };
  }

  cleanupOldClips() {
    const cutoff = Date.now() - this.CLIP_RETENTION;
    const oldClips = this.data.clips.filter((clip) => new Date(clip.timestamp).getTime() < cutoff);

    oldClips.forEach((clip) => {
      // Remove from categories
      Object.values(this.data.categories).forEach((categoryClips) => {
        const index = categoryClips.indexOf(clip.id);
        if (index !== -1) {
          categoryClips.splice(index, 1);
        }
      });

      // Remove from tags
      Object.values(this.data.tags).forEach((tagClips) => {
        const index = tagClips.indexOf(clip.id);
        if (index !== -1) {
          tagClips.splice(index, 1);
        }
      });
    });

    // Remove empty categories and tags
    Object.entries(this.data.categories).forEach(([category, clips]) => {
      if (clips.length === 0) {
        delete this.data.categories[category];
      }
    });

    Object.entries(this.data.tags).forEach(([tag, clips]) => {
      if (clips.length === 0) {
        delete this.data.tags[tag];
      }
    });

    // Update clips array
    this.data.clips = this.data.clips.filter(
      (clip) => new Date(clip.timestamp).getTime() >= cutoff
    );

    this.saveData();
  }
}

const clipManager = new ClipManager();
export default clipManager;
=======
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import logger from '../utils/logger.js';
import { generateResponse } from '../utils/perplexity.js';
import { ApiClient } from '@twurple/api';
import { RefreshingAuthProvider } from '@twurple/auth';
import tokenManager from '../auth/tokenManager.js';

class ClipManager {
  constructor() {
    this.dbPath = join(process.cwd(), 'src/bot/clips_data.json');
    this.data = this.loadData();
    this.CLIP_RETENTION = 30 * 24 * 60 * 60 * 1000; // 30 days
  }

  loadData() {
    try {
      if (existsSync(this.dbPath)) {
        const data = readFileSync(this.dbPath, 'utf8');
        return JSON.parse(data);
      }
      const defaultData = {
        clips: [],
        categories: {},
        tags: {},
        highlights: [],
        compilations: [],
      };
      this.saveData(defaultData);
      return defaultData;
    } catch (error) {
      logger.error('Error loading clips data:', error);
      return {
        clips: [],
        categories: {},
        tags: {},
        highlights: [],
        compilations: [],
      };
    }
  }

  saveData(data = this.data) {
    try {
      writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error('Error saving clips data:', error);
    }
  }

  async createClip(title, creator) {
    try {
      const tokens = await tokenManager.getBroadcasterTokens();
      const authProvider = new RefreshingAuthProvider({
        clientId: tokens.clientId,
        clientSecret: tokens.clientSecret,
        onRefresh: async (userId, newTokenData) => {
          await tokenManager.updateBroadcasterTokens(newTokenData);
        },
      });

      await authProvider.addUserForToken({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 0,
        obtainmentTimestamp: 0,
      });

      const apiClient = new ApiClient({ authProvider });
      const clip = await apiClient.clips.createClip({ channel: tokens.userId });

      if (clip) {
        // Get clip details
        const clipData = await apiClient.clips.getClipById(clip.id);

        // Generate tags and category using AI
        const analysisPrompt = `Analyze this clip title and creator's name to suggest relevant tags and a category.
Title: "${title}"
Creator: ${creator}

Respond with JSON only:
{
  "tags": ["array of 3-5 relevant tags"],
  "category": "string (one of: Funny, Skillful, Informative, Highlight, Reaction, Social)"
}`;

        const analysis = JSON.parse(await generateResponse(analysisPrompt));

        const clipInfo = {
          id: clip.id,
          url: clipData.url,
          title,
          creator,
          timestamp: new Date().toISOString(),
          views: 0,
          category: analysis.category,
          tags: analysis.tags,
          reactions: {
            likes: 0,
            shares: 0,
          },
        };

        // Update data structures
        this.data.clips.push(clipInfo);

        // Update category stats
        if (!this.data.categories[analysis.category]) {
          this.data.categories[analysis.category] = [];
        }
        this.data.categories[analysis.category].push(clip.id);

        // Update tag stats
        analysis.tags.forEach((tag) => {
          if (!this.data.tags[tag]) {
            this.data.tags[tag] = [];
          }
          this.data.tags[tag].push(clip.id);
        });

        this.saveData();
        return clipInfo;
      }
    } catch (error) {
      logger.error('Error creating clip:', error);
    }
    return null;
  }

  async suggestCompilation() {
    try {
      const recentClips = this.data.clips
        .filter((clip) => {
          const clipDate = new Date(clip.timestamp);
          return Date.now() - clipDate.getTime() <= this.CLIP_RETENTION;
        })
        .sort((a, b) => b.reactions.likes - a.reactions.likes);

      if (recentClips.length < 3) {
        return null;
      }

      const prompt = `Analyze these clips and suggest a compilation theme:
Clips: ${JSON.stringify(recentClips.slice(0, 10))}

Respond with JSON only:
{
  "theme": "string (compilation theme/title)",
  "description": "string (brief description)",
  "selectedClips": ["array of clip IDs to include"],
  "order": ["array of clip IDs in suggested order"],
  "transitions": ["array of transition suggestions between clips"]
}`;

      const suggestion = JSON.parse(await generateResponse(prompt));

      const compilation = {
        id: Date.now().toString(),
        ...suggestion,
        timestamp: new Date().toISOString(),
        status: 'suggested',
      };

      this.data.compilations.push(compilation);
      this.saveData();

      return compilation;
    } catch (error) {
      logger.error('Error suggesting compilation:', error);
      return null;
    }
  }

  getClipsByCategory(category) {
    return this.data.categories[category] || [];
  }

  getClipsByTag(tag) {
    return this.data.tags[tag] || [];
  }

  getRecentClips(days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return this.data.clips
      .filter((clip) => new Date(clip.timestamp) > cutoff)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  getTopClips(limit = 10) {
    return this.data.clips.sort((a, b) => b.reactions.likes - a.reactions.likes).slice(0, limit);
  }

  async analyzeClipPerformance(clipId) {
    const clip = this.data.clips.find((c) => c.id === clipId);
    if (!clip) {
      return null;
    }

    try {
      const prompt = `Analyze this clip's performance:
Clip Data: ${JSON.stringify(clip)}

Respond with JSON only:
{
  "performance": "string (excellent/good/fair/poor)",
  "insights": ["array of performance insights"],
  "recommendations": ["array of improvement suggestions"],
  "similarSuccessful": ["array of similar successful clip IDs"]
}`;

      return JSON.parse(await generateResponse(prompt));
    } catch (error) {
      logger.error('Error analyzing clip performance:', error);
      return null;
    }
  }

  getClipStats() {
    const totalClips = this.data.clips.length;
    const categoryDistribution = Object.fromEntries(
      Object.entries(this.data.categories).map(([cat, clips]) => [cat, clips.length])
    );
    const popularTags = Object.entries(this.data.tags)
      .map(([tag, clips]) => ({ tag, count: clips.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalClips,
      categoryDistribution,
      popularTags,
      recentClips: this.getRecentClips(7).length,
      compilations: this.data.compilations.length,
    };
  }

  cleanupOldClips() {
    const cutoff = Date.now() - this.CLIP_RETENTION;
    const oldClips = this.data.clips.filter((clip) => new Date(clip.timestamp).getTime() < cutoff);

    oldClips.forEach((clip) => {
      // Remove from categories
      Object.values(this.data.categories).forEach((categoryClips) => {
        const index = categoryClips.indexOf(clip.id);
        if (index !== -1) {
          categoryClips.splice(index, 1);
        }
      });

      // Remove from tags
      Object.values(this.data.tags).forEach((tagClips) => {
        const index = tagClips.indexOf(clip.id);
        if (index !== -1) {
          tagClips.splice(index, 1);
        }
      });
    });

    // Remove empty categories and tags
    Object.entries(this.data.categories).forEach(([category, clips]) => {
      if (clips.length === 0) {
        delete this.data.categories[category];
      }
    });

    Object.entries(this.data.tags).forEach(([tag, clips]) => {
      if (clips.length === 0) {
        delete this.data.tags[tag];
      }
    });

    // Update clips array
    this.data.clips = this.data.clips.filter(
      (clip) => new Date(clip.timestamp).getTime() >= cutoff
    );

    this.saveData();
  }
}

const clipManager = new ClipManager();
export default clipManager;
>>>>>>> origin/master
