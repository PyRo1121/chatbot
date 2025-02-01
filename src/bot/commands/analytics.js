<<<<<<< HEAD
import streamAnalytics from '../streamAnalytics.js';
import viewerManager from '../viewerManager.js';
import chatInteraction from '../chatInteraction.js';

export const analyticsCommands = {
  // Get comprehensive stream health report
  health: async () => {
    // Wait for health metrics to be collected
    await new Promise((resolve) => setTimeout(resolve, 100));
    const health = streamAnalytics.getStreamHealth();
    if (typeof health === 'string') {
      return health;
    }

    return `🏥 Stream Health:
    Bitrate: ${health.bitrate}kbps
    Dropped Frames: ${health.droppedFrames}
    Current Viewers: ${health.viewers}
    Uptime: ${health.uptime} minutes`;
  },

  // Get detailed stream insights
  insights: async () => {
    const insights = await streamAnalytics.getStreamInsights();
    const viewerStats = viewerManager.getViewerStats();
    const chatStats = chatInteraction.getStats();

    if (!insights.currentStream.health || typeof insights.currentStream.health === 'string') {
      return 'Stream analytics not available. Is the stream live?';
    }

    const { analysis } = insights.currentStream;
    const { performance } = insights.currentStream;

    return `📊 Stream Analytics Report

🏥 Technical Health: ${analysis.status}
${analysis.issues.length > 0 ? `⚠️ Issues:\n${analysis.issues.map((i) => `  • ${i}`).join('\n')}` : '✅ No issues detected'}
${analysis.recommendations.length > 0 ? `💡 Recommendations:\n${analysis.recommendations.map((r) => `  • ${r}`).join('\n')}` : ''}

📈 Performance Metrics:
• Best Category: ${performance.bestCategory}
• Viewer Retention: ${performance.viewerRetention}%
• Peak Times: ${performance.peakTimes.join(', ')}

👥 Community Stats:
• Total Unique Viewers: ${viewerStats.totalUnique}
• Returning Rate: ${viewerStats.returningRate}%
• Top Viewer: ${viewerStats.topViewers[0]?.username} (${viewerStats.topViewers[0]?.level})

💭 Chat Analysis:
• Mood: ${chatStats.chatMood.current.sentiment}
• Energy Level: ${chatStats.chatMood.current.energy}
• Top Topics: ${chatStats.topTopics
      .slice(0, 3)
      .map((t) => t.topic)
      .join(', ')}

${performance.suggestions.length > 0 ? `💡 Growth Suggestions:\n${performance.suggestions.map((s) => `  • ${s}`).join('\n')}` : ''}`;
  },

  // Get best streaming times
  besttimes: async () => {
    // Wait for historical data to be analyzed
    await new Promise((resolve) => setTimeout(resolve, 100));
    const bestTimes = streamAnalytics.getBestTimes();
    return `⏰ Best Streaming Times:
    ${bestTimes
      .map(
        (time) =>
          `${time.hour}:00 - Avg: ${time.averageViewers} viewers, Peak: ${time.peakViewers} viewers`
      )
      .join('\n    ')}`;
  },

  // Get top performing categories
  topcategories: async () => {
    // Wait for category performance data to be processed
    await new Promise((resolve) => setTimeout(resolve, 100));
    const categories = streamAnalytics.getTopCategories();
    return `🎮 Top Performing Categories:
    ${categories
      .map(
        (cat) =>
          `${cat.category} - Avg: ${Math.round(cat.stats.averageViewers)} viewers, Peak: ${
            cat.stats.peakViewers
          } viewers`
      )
      .join('\n    ')}`;
  },

  // Get stream performance analysis
  performance: async () => {
    const analysis = await streamAnalytics.analyzeStreamPerformance();
    if (!analysis) {
      return 'Unable to analyze stream performance at this time.';
    }

    return `🎯 Stream Performance Analysis:

Health Status: ${analysis.health.status}
${
  analysis.health.issues.length > 0
    ? `⚠️ Issues Detected:\n${analysis.health.issues.map((i) => `  • ${i}`).join('\n')}`
    : '✅ No issues detected'
}

Performance Metrics:
• Best Category: ${analysis.performance.bestCategory}
• Viewer Retention: ${analysis.performance.viewerRetention}%
• Peak Activity: ${analysis.performance.peakTimes.join(', ')}

${
  analysis.performance.suggestions.length > 0
    ? `💡 Suggestions:\n${analysis.performance.suggestions.map((s) => `  • ${s}`).join('\n')}`
    : ''
}`;
  },
};

// Initialize stream analytics when stream starts
export function initializeAnalytics() {
  streamAnalytics.initializeStream();
  // Start health monitoring
  setInterval(async () => {
    await streamAnalytics.updateStreamHealth();
  }, streamAnalytics.UPDATE_INTERVAL);
}

// Clean up analytics when stream ends
export async function endAnalytics() {
  const analysis = await streamAnalytics.endStream();
  return analysis;
}
=======
import streamAnalytics from '../streamAnalytics.js';
import viewerManager from '../viewerManager.js';
import chatInteraction from '../chatInteraction.js';

export const analyticsCommands = {
  // Get comprehensive stream health report
  health: async () => {
    // Wait for health metrics to be collected
    await new Promise((resolve) => setTimeout(resolve, 100));
    const health = streamAnalytics.getStreamHealth();
    if (typeof health === 'string') {
      return health;
    }

    return `🏥 Stream Health:
    Bitrate: ${health.bitrate}kbps
    Dropped Frames: ${health.droppedFrames}
    Current Viewers: ${health.viewers}
    Uptime: ${health.uptime} minutes`;
  },

  // Get detailed stream insights
  insights: async () => {
    const insights = await streamAnalytics.getStreamInsights();
    const viewerStats = viewerManager.getViewerStats();
    const chatStats = chatInteraction.getStats();

    if (!insights.currentStream.health || typeof insights.currentStream.health === 'string') {
      return 'Stream analytics not available. Is the stream live?';
    }

    const { analysis } = insights.currentStream;
    const { performance } = insights.currentStream;

    return `📊 Stream Analytics Report

🏥 Technical Health: ${analysis.status}
${analysis.issues.length > 0 ? `⚠️ Issues:\n${analysis.issues.map((i) => `  • ${i}`).join('\n')}` : '✅ No issues detected'}
${analysis.recommendations.length > 0 ? `💡 Recommendations:\n${analysis.recommendations.map((r) => `  • ${r}`).join('\n')}` : ''}

📈 Performance Metrics:
• Best Category: ${performance.bestCategory}
• Viewer Retention: ${performance.viewerRetention}%
• Peak Times: ${performance.peakTimes.join(', ')}

👥 Community Stats:
• Total Unique Viewers: ${viewerStats.totalUnique}
• Returning Rate: ${viewerStats.returningRate}%
• Top Viewer: ${viewerStats.topViewers[0]?.username} (${viewerStats.topViewers[0]?.level})

💭 Chat Analysis:
• Mood: ${chatStats.chatMood.current.sentiment}
• Energy Level: ${chatStats.chatMood.current.energy}
• Top Topics: ${chatStats.topTopics
      .slice(0, 3)
      .map((t) => t.topic)
      .join(', ')}

${performance.suggestions.length > 0 ? `💡 Growth Suggestions:\n${performance.suggestions.map((s) => `  • ${s}`).join('\n')}` : ''}`;
  },

  // Get best streaming times
  besttimes: async () => {
    // Wait for historical data to be analyzed
    await new Promise((resolve) => setTimeout(resolve, 100));
    const bestTimes = streamAnalytics.getBestTimes();
    return `⏰ Best Streaming Times:
    ${bestTimes
      .map(
        (time) =>
          `${time.hour}:00 - Avg: ${time.averageViewers} viewers, Peak: ${time.peakViewers} viewers`
      )
      .join('\n    ')}`;
  },

  // Get top performing categories
  topcategories: async () => {
    // Wait for category performance data to be processed
    await new Promise((resolve) => setTimeout(resolve, 100));
    const categories = streamAnalytics.getTopCategories();
    return `🎮 Top Performing Categories:
    ${categories
      .map(
        (cat) =>
          `${cat.category} - Avg: ${Math.round(cat.stats.averageViewers)} viewers, Peak: ${
            cat.stats.peakViewers
          } viewers`
      )
      .join('\n    ')}`;
  },

  // Get stream performance analysis
  performance: async () => {
    const analysis = await streamAnalytics.analyzeStreamPerformance();
    if (!analysis) {
      return 'Unable to analyze stream performance at this time.';
    }

    return `🎯 Stream Performance Analysis:

Health Status: ${analysis.health.status}
${
  analysis.health.issues.length > 0
    ? `⚠️ Issues Detected:\n${analysis.health.issues.map((i) => `  • ${i}`).join('\n')}`
    : '✅ No issues detected'
}

Performance Metrics:
• Best Category: ${analysis.performance.bestCategory}
• Viewer Retention: ${analysis.performance.viewerRetention}%
• Peak Activity: ${analysis.performance.peakTimes.join(', ')}

${
  analysis.performance.suggestions.length > 0
    ? `💡 Suggestions:\n${analysis.performance.suggestions.map((s) => `  • ${s}`).join('\n')}`
    : ''
}`;
  },
};

// Initialize stream analytics when stream starts
export function initializeAnalytics() {
  streamAnalytics.initializeStream();
  // Start health monitoring
  setInterval(async () => {
    await streamAnalytics.updateStreamHealth();
  }, streamAnalytics.UPDATE_INTERVAL);
}

// Clean up analytics when stream ends
export async function endAnalytics() {
  const analysis = await streamAnalytics.endStream();
  return analysis;
}
>>>>>>> origin/master
