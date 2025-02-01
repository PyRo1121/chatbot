import { generateResponse } from '../../utils/perplexity.js';
import logger from '../../utils/logger.js';

// Store optimization data
const optimizationData = {
  categories: {
    current: '',
    history: [],
    performance: {},
  },
  titles: {
    current: '',
    history: [],
    performance: {},
  },
  tags: {
    current: [],
    history: [],
    performance: {},
  },
  schedule: {
    history: [],
    performance: {},
    recommendations: [],
  },
};

// Update category performance
export function updateCategoryPerformance(category, viewers, duration) {
  if (!optimizationData.categories.performance[category]) {
    optimizationData.categories.performance[category] = {
      totalViewers: 0,
      totalDuration: 0,
      peaks: [],
      averageViewers: 0,
    };
  }

  const perf = optimizationData.categories.performance[category];
  perf.totalViewers += viewers;
  perf.totalDuration += duration;
  perf.peaks.push({ viewers, timestamp: new Date() });
  perf.averageViewers = perf.totalViewers / perf.peaks.length;
}

// Get category suggestions
export async function getCategorySuggestions() {
  // Prepare performance data for analysis
  const performanceData = {
    categories: optimizationData.categories.performance,
    currentCategory: optimizationData.categories.current,
    recentHistory: optimizationData.categories.history.slice(-5),
  };

  const prompt = `Analyze this streaming category performance data and suggest optimal categories to stream in: ${JSON.stringify(performanceData)}. Consider viewer retention, growth trends, and current streaming meta.`;
  const systemPrompt =
    'You are a content optimization assistant. Provide data-driven category suggestions that could help grow the channel.';

  const suggestions = await generateResponse(prompt, systemPrompt);
  return suggestions || 'Unable to generate category suggestions at this time.';
}

// Generate stream title
export async function generateStreamTitle(category, description = '') {
  const titleData = {
    category,
    description,
    currentTitle: optimizationData.titles.current,
    recentTitles: optimizationData.titles.history.slice(-3),
  };

  const prompt = `Generate an engaging stream title for a ${category} stream. Additional context: ${JSON.stringify(titleData)}`;
  const systemPrompt =
    'You are a stream title generator. Create catchy, SEO-friendly titles that attract viewers while accurately describing the content. Keep titles under 100 characters.';

  const title = await generateResponse(prompt, systemPrompt);
  return title || 'Unable to generate stream title at this time.';
}

// Get schedule recommendations
export async function getScheduleRecommendations() {
  const scheduleData = {
    history: optimizationData.schedule.history,
    performance: optimizationData.schedule.performance,
    currentRecommendations: optimizationData.schedule.recommendations,
  };

  const prompt = `Analyze this streaming schedule data and suggest optimal streaming times: ${JSON.stringify(scheduleData)}. Consider viewer retention, peak concurrent viewers, and growth patterns.`;
  const systemPrompt =
    'You are a schedule optimization assistant. Provide data-driven streaming schedule recommendations to maximize viewer engagement.';

  const recommendations = await generateResponse(prompt, systemPrompt);
  return (
    recommendations ||
    'Unable to generate schedule recommendations at this time.'
  );
}

// Get tag recommendations
export async function getTagRecommendations(category, title = '') {
  const tagData = {
    category,
    title,
    currentTags: optimizationData.tags.current,
    historicalPerformance: optimizationData.tags.performance,
  };

  const prompt = `Suggest optimal streaming tags for a ${category} stream with title "${title}". Context: ${JSON.stringify(tagData)}`;
  const systemPrompt =
    'You are a tag optimization assistant. Suggest relevant, discoverable tags that will help the stream reach its target audience. Focus on a mix of broad and niche tags.';

  const recommendations = await generateResponse(prompt, systemPrompt);
  return (
    recommendations || 'Unable to generate tag recommendations at this time.'
  );
}

// Update current category
export function updateCurrentCategory(category) {
  optimizationData.categories.current = category;
  optimizationData.categories.history.push({
    category,
    timestamp: new Date(),
  });
}

// Update current title
export function updateCurrentTitle(title) {
  optimizationData.titles.current = title;
  optimizationData.titles.history.push({
    title,
    timestamp: new Date(),
  });
}

// Update current tags
export function updateCurrentTags(tags) {
  optimizationData.tags.current = tags;
  optimizationData.tags.history.push({
    tags,
    timestamp: new Date(),
  });
}

// Update schedule performance
export function updateSchedulePerformance(
  startTime,
  endTime,
  averageViewers,
  peakViewers
) {
  optimizationData.schedule.history.push({
    startTime,
    endTime,
    averageViewers,
    peakViewers,
    timestamp: new Date(),
  });

  // Update performance metrics by time slot
  const timeSlot = startTime.getHours();
  if (!optimizationData.schedule.performance[timeSlot]) {
    optimizationData.schedule.performance[timeSlot] = {
      totalStreams: 0,
      totalViewers: 0,
      averageViewers: 0,
      peakViewers: 0,
    };
  }

  const perf = optimizationData.schedule.performance[timeSlot];
  perf.totalStreams++;
  perf.totalViewers += averageViewers;
  perf.averageViewers = perf.totalViewers / perf.totalStreams;
  perf.peakViewers = Math.max(perf.peakViewers, peakViewers);
}

// Reset optimization data
export function resetOptimizationData() {
  optimizationData.categories = {
    current: '',
    history: [],
    performance: {},
  };
  optimizationData.titles = {
    current: '',
    history: [],
    performance: {},
  };
  optimizationData.tags = {
    current: [],
    history: [],
    performance: {},
  };
  optimizationData.schedule = {
    history: [],
    performance: {},
    recommendations: [],
  };
}

export default {
  updateCategoryPerformance,
  getCategorySuggestions,
  generateStreamTitle,
  getScheduleRecommendations,
  getTagRecommendations,
  updateCurrentCategory,
  updateCurrentTitle,
  updateCurrentTags,
  updateSchedulePerformance,
  resetOptimizationData,
};
