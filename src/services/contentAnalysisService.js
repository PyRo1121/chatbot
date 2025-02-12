import { LRUCache } from 'lru-cache';
import logger from '../utils/logger.js';
import  AIService from '../utils/aiService.js';

class ContentAnalysisService {
    constructor() {
        this.viewerPreferences = new LRUCache({
            max: 1000,
            ttl: 1000 * 60 * 60 * 24, // 24 hours
        });

        this.contentCategories = new Map([
            ['gaming', /\b(game|play|stream|gaming|fps|moba|rpg)\b/i],
            ['chatting', /\b(talk|chat|discussion|conversation)\b/i],
            ['music', /\b(song|music|playlist|track|beat)\b/i],
            ['tech', /\b(computer|code|programming|software|hardware)\b/i],
        ]);

        this.highlightTriggers = {
            messageRate: 0,
            lastCheck: Date.now(),
            messages: [],
            threshold: 10, // messages per minute to trigger highlight
        };
    }

    async analyzeMessage(username, message, context = {}) {
        try {
            // Get existing preferences or create new ones
            const prefs = this.getViewerPreferences(username);

            // Analyze message content
            const categories = this.categorizeContent(message);
            const sentiment = await AIService.analyzeMessage(message);

            // Update preferences based on interaction
            this.updatePreferences(username, categories, sentiment);

            // Check for highlight-worthy moments
            this.trackMessageForHighlights(username, message, sentiment);

            return {
                categories,
                sentiment,
                preferences: prefs,
            };
        } catch (error) {
            logger.error('Error analyzing message:', error);
            return null;
        }
    }

    getViewerPreferences(username) {
        return this.viewerPreferences.get(username) || {
            interests: new Map(),
            sentimentHistory: [],
            interactionTimes: [],
            contentPreferences: new Map(),
        };
    }

    updatePreferences(username, categories, sentiment) {
        const prefs = this.getViewerPreferences(username);

        // Update category interests
        categories.forEach(category => {
            const current = prefs.interests.get(category) || 0;
            prefs.interests.set(category, current + 1);
        });

        // Track sentiment
        prefs.sentimentHistory.push({
            sentiment,
            timestamp: Date.now(),
        });

        // Keep only last 50 sentiment records
        if (prefs.sentimentHistory.length > 50) {
            prefs.sentimentHistory.shift();
        }

        // Track interaction time
        prefs.interactionTimes.push(Date.now());
        prefs.interactionTimes = prefs.interactionTimes.filter(time =>
            Date.now() - time < 24 * 60 * 60 * 1000
        );

        this.viewerPreferences.set(username, prefs);
    }

    categorizeContent(message) {
        const categories = new Set();

        for (const [category, pattern] of this.contentCategories) {
            if (pattern.test(message)) {
                categories.add(category);
            }
        }

        return Array.from(categories);
    }

    trackMessageForHighlights(username, message, sentiment) {
        const now = Date.now();
        this.highlightTriggers.messages.push({
            timestamp: now,
            username,
            message,
            sentiment,
        });

        // Remove messages older than 1 minute
        this.highlightTriggers.messages = this.highlightTriggers.messages.filter(
            msg => now - msg.timestamp < 60000
        );

        // Update message rate
        this.highlightTriggers.messageRate = this.highlightTriggers.messages.length;

        return this.checkForHighlight();
    }

    checkForHighlight() {
        if (this.highlightTriggers.messageRate >= this.highlightTriggers.threshold) {
            const messages = [...this.highlightTriggers.messages];
            this.highlightTriggers.messages = []; // Reset after highlight
            return {
                type: 'chat_highlight',
                messages,
                timestamp: Date.now(),
                reason: 'High message rate',
            };
        }
        return null;
    }

    getRecommendations(username) {
        const prefs = this.getViewerPreferences(username);
        if (!prefs) {
            return null;
        }

        // Sort interests by frequency
        const sortedInterests = Array.from(prefs.interests.entries())
            .sort((a, b) => b[1] - a[1]);

        // Get top categories
        const topCategories = sortedInterests.slice(0, 3);

        return {
            interests: topCategories,
            activeHours: this.getActiveHours(prefs.interactionTimes),
            sentiment: this.calculateAverageSentiment(prefs.sentimentHistory),
        };
    }

    getActiveHours(timestamps) {
        const hours = timestamps.map(ts => new Date(ts).getHours());
        const hourCounts = hours.reduce((acc, hour) => {
            acc[hour] = (acc[hour] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(hourCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([hour]) => parseInt(hour));
    }

    calculateAverageSentiment(history) {
        if (!history.length) {
            return 0;
        }
        return history.reduce((sum, entry) => sum + entry.sentiment, 0) / history.length;
    }
}

export const contentAnalysisService = new ContentAnalysisService();
