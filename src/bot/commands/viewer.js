import viewerManager from '../viewerManager.js';

export const viewerCommands = {
  // Get viewer stats and loyalty information
  stats: async () => {
    // Wait for viewer stats to be processed
    await new Promise((resolve) => setTimeout(resolve, 100));
    const stats = viewerManager.getViewerStats();
    return `📊 Viewer Stats:
    Total Unique Viewers: ${stats.totalUnique}
    Returning Rate: ${stats.returningRate}%
    Top Viewers: ${stats.topViewers
      .slice(0, 5)
      .map((v) => `${v.username} (${v.level})`)
      .join(', ')}
    Recent Raids: ${stats.recentRaids
      .slice(0, 3)
      .map((r) => `${r.raider} (${r.viewers})`)
      .join(', ')}`;
  },

  // Show loyalty distribution
  loyalty: async () => {
    // Wait for loyalty data to be calculated
    await new Promise((resolve) => setTimeout(resolve, 100));
    const stats = viewerManager.getViewerStats();
    return `👥 Community Loyalty:
    ${Object.entries(stats.loyaltyDistribution)
      .map(([level, count]) => `${level}: ${count}`)
      .join('\n    ')}`;
  },

  // Show top viewers
  topviewers: async () => {
    // Wait for viewer rankings to be calculated
    await new Promise((resolve) => setTimeout(resolve, 100));
    const stats = viewerManager.getViewerStats();
    return `🏆 Top Viewers:
    ${stats.topViewers
      .map((v, i) => `${i + 1}. ${v.username} - ${v.level} (${v.visits} visits)`)
      .join('\n    ')}`;
  },

  // Show recent raids
  raids: async () => {
    // Wait for raid history to be loaded
    await new Promise((resolve) => setTimeout(resolve, 100));
    const stats = viewerManager.getViewerStats();
    if (stats.recentRaids.length === 0) {
      return "No recent raids. Let's get some raids going! 🎉";
    }
    return `🎮 Recent Raids:
    ${stats.recentRaids
      .map(
        (r) =>
          `${r.raider} brought ${r.viewers} raiders on ${new Date(r.timestamp).toLocaleDateString()}`
      )
      .join('\n    ')}`;
  },
};

// Handle raid events
export async function handleRaid(raider, viewers) {
  const welcomeMessage = await viewerManager.handleRaid(raider, viewers);
  return welcomeMessage;
}

// Track viewer activity
export function trackViewer(username) {
  const milestone = viewerManager.trackViewer(username);
  if (milestone) {
    return milestone.message;
  }
  return null;
}
