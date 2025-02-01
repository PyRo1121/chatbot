import streamAnalytics from '../streamAnalytics.js';
import analytics from '../analytics.js';
import logger from '../../utils/logger.js';

export async function handleRecommendations() {
  try {
    const stats = analytics.getStats();
    const recommendations = await streamAnalytics.getRecommendations(stats);
    return recommendations.join(' | ');
  } catch (error) {
    logger.error('Error getting recommendations:', error);
    return 'Unable to generate recommendations at this time';
  }
}

export async function handleViewerStats() {
  try {
    const stats = analytics.getStats();
    return `Viewer Stats: Total: ${stats.viewerStats.total} | New: ${stats.viewerStats.new} | Returning: ${stats.viewerStats.returning} | Peak: ${stats.peakViewers}`;
  } catch (error) {
    logger.error('Error getting viewer stats:', error);
    return 'Unable to get viewer stats at this time';
  }
}

export async function handleLoyalty() {
  try {
    const stats = analytics.getStats();
    return `Stream Loyalty: Total Hours: ${Math.round(stats.totalHours)} | Total Streams: ${stats.totalStreams} | Average Viewers: ${Math.round(stats.currentStream.viewers.reduce((a, b) => a + b, 0) / stats.currentStream.viewers.length || 0)}`;
  } catch (error) {
    logger.error('Error getting loyalty stats:', error);
    return 'Unable to get loyalty stats at this time';
  }
}

export async function handleTopViewers() {
  try {
    const stats = analytics.getStats();
    const topViewers = stats.topViewers
      .slice(0, 5)
      .map((viewer) => `${viewer.username}(${viewer.minutes}m)`)
      .join(', ');
    return `Top Viewers: ${topViewers}`;
  } catch (error) {
    logger.error('Error getting top viewers:', error);
    return 'Unable to get top viewers at this time';
  }
}

export async function handleRaids() {
  try {
    const stats = analytics.getStats();
    if (stats.currentStream.raids.length === 0) {
      return 'No raids yet this stream!';
    }
    const recentRaids = stats.currentStream.raids
      .slice(-3)
      .map((raid) => `${raid.username}(${raid.viewers})`)
      .join(', ');
    return `Recent Raids: ${recentRaids}`;
  } catch (error) {
    logger.error('Error getting raids:', error);
    return 'Unable to get raid history at this time';
  }
}

export async function handleHealth() {
  try {
    const health = await streamAnalytics.getStreamHealth();
    return `Stream Health: Status: ${health.status} | Score: ${health.score}/100 | Bitrate: ${health.bitrate.average}kbps (${health.bitrate.stability})`;
  } catch (error) {
    logger.error('Error getting stream health:', error);
    return 'Unable to get stream health at this time';
  }
}

export async function handleStreamPerformance() {
  try {
    const performance = await streamAnalytics.getStreamPerformance();
    return `Stream Performance: Viewer Retention: ${performance.viewerRetention}% | Engagement: ${performance.averageEngagement}% | Best Category: ${performance.bestCategory}`;
  } catch (error) {
    logger.error('Error getting stream performance:', error);
    return 'Unable to get stream performance at this time';
  }
}

export async function handleBestTimes() {
  try {
    const bestTimes = await streamAnalytics.getBestStreamingTimes();
    const formattedTimes = bestTimes
      .slice(0, 3)
      .map((t) => `${t.time} (${t.averageViewers} avg)`)
      .join(' | ');
    return `Best Streaming Times: ${formattedTimes}`;
  } catch (error) {
    logger.error('Error getting best times:', error);
    return 'Unable to get best streaming times at this time';
  }
}

export async function handleTopCategories() {
  try {
    const categories = await streamAnalytics.getTopCategories();
    const formattedCategories = categories
      .slice(0, 3)
      .map((c) => `${c.name} (${c.hours}h, ${c.averageViewers} avg)`)
      .join(' | ');
    return `Top Categories: ${formattedCategories}`;
  } catch (error) {
    logger.error('Error getting top categories:', error);
    return 'Unable to get top categories at this time';
  }
}
