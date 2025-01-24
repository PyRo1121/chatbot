import clipManager from '../clipManager.js';

export const clipManagementCommands = {
  // Create and categorize a new clip
  createclip: async (client, channel, user, title) => {
    const clipInfo = await clipManager.createClip(title || 'Stream Highlight', user.username);
    if (!clipInfo) {
      return 'Failed to create clip. Please try again.';
    }
    return `Clip created! 📎 ${clipInfo.url}
Category: ${clipInfo.category}
Tags: ${clipInfo.tags.join(', ')}`;
  },

  // Get clips by category
  clipsbycategory: async (category) => {
    // Wait for clips to be loaded and filtered
    await new Promise((resolve) => setTimeout(resolve, 100));
    const clips = clipManager.getClipsByCategory(category);
    if (!clips || clips.length === 0) {
      return `No clips found in category: ${category}`;
    }

    const clipList = clips
      .slice(0, 5)
      .map((clipId) => {
        const clip = clipManager.data.clips.find((c) => c.id === clipId);
        return clip ? `• ${clip.title} (${clip.url})` : null;
      })
      .filter(Boolean);

    return `📂 Clips in ${category} (showing ${clipList.length}/${clips.length}):
${clipList.join('\n')}`;
  },

  // Get clips by tag
  clipsbytag: async (tag) => {
    // Wait for clips to be loaded and filtered by tag
    await new Promise((resolve) => setTimeout(resolve, 100));
    const clips = clipManager.getClipsByTag(tag);
    if (!clips || clips.length === 0) {
      return `No clips found with tag: ${tag}`;
    }

    const clipList = clips
      .slice(0, 5)
      .map((clipId) => {
        const clip = clipManager.data.clips.find((c) => c.id === clipId);
        return clip ? `• ${clip.title} (${clip.url})` : null;
      })
      .filter(Boolean);

    return `🏷️ Clips tagged "${tag}" (showing ${clipList.length}/${clips.length}):
${clipList.join('\n')}`;
  },

  // Get recent clips
  recentclips: async (days = 7) => {
    // Wait for recent clips to be loaded
    await new Promise((resolve) => setTimeout(resolve, 100));
    const clips = clipManager.getRecentClips(days);
    if (clips.length === 0) {
      return `No clips found from the last ${days} days`;
    }

    const clipList = clips.slice(0, 5).map((clip) => `• ${clip.title} (${clip.url})`);

    return `🎬 Recent Clips (last ${days} days, showing ${clipList.length}/${clips.length}):
${clipList.join('\n')}`;
  },

  // Get top clips
  topclips: async () => {
    // Wait for clips to be sorted by popularity
    await new Promise((resolve) => setTimeout(resolve, 100));
    const clips = clipManager.getTopClips(5);
    if (clips.length === 0) {
      return 'No clips found';
    }

    const clipList = clips.map(
      (clip) => `• ${clip.title} (${clip.reactions.likes} likes) - ${clip.url}`
    );

    return `🏆 Top Clips:
${clipList.join('\n')}`;
  },

  // Get clip stats
  clipstats: async () => {
    // Wait for clip statistics to be calculated
    await new Promise((resolve) => setTimeout(resolve, 100));
    const stats = clipManager.getClipStats();
    const categoryList = Object.entries(stats.categoryDistribution)
      .map(([cat, count]) => `${cat}: ${count}`)
      .join(', ');
    const tagList = stats.popularTags.map((t) => `${t.tag} (${t.count})`).join(', ');

    return `📊 Clip Statistics:
Total Clips: ${stats.totalClips}
Recent Clips (7 days): ${stats.recentClips}
Categories: ${categoryList}
Popular Tags: ${tagList}
Compilations: ${stats.compilations}`;
  },

  // Suggest clip compilation
  suggestcompilation: async () => {
    const compilation = await clipManager.suggestCompilation();
    if (!compilation) {
      return 'Not enough clips available for a compilation suggestion.';
    }

    const clipList = compilation.selectedClips
      .map((clipId, index) => {
        const clip = clipManager.data.clips.find((c) => c.id === clipId);
        return clip ? `${index + 1}. ${clip.title} - ${clip.url}` : null;
      })
      .filter(Boolean);

    return `🎬 Suggested Compilation: "${compilation.theme}"
${compilation.description}

Selected Clips:
${clipList.join('\n')}

Editing Suggestions:
${compilation.transitions.map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
  },

  // Analyze clip performance
  analyzeclip: async (clipId) => {
    const analysis = await clipManager.analyzeClipPerformance(clipId);
    if (!analysis) {
      return 'Clip not found or analysis failed.';
    }

    return `📈 Clip Performance Analysis:
Status: ${analysis.performance}

Key Insights:
${analysis.insights.map((i) => `• ${i}`).join('\n')}

Recommendations:
${analysis.recommendations.map((r) => `• ${r}`).join('\n')}

Similar Successful Clips:
${analysis.similarSuccessful
  .map((id) => {
    const clip = clipManager.data.clips.find((c) => c.id === id);
    return clip ? `• ${clip.title} (${clip.url})` : null;
  })
  .filter(Boolean)
  .join('\n')}`;
  },
};

// Initialize clip cleanup interval
setInterval(
  () => {
    clipManager.cleanupOldClips();
  },
  24 * 60 * 60 * 1000
); // Run daily
