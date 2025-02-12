import logger from './logger.js';
import { LRUCache } from 'lru-cache';
import aiService from '../utils/aiService.js';

class SentimentHandler {
    constructor() {
        this.moodCache = new LRUCache({
            max: 1000,
            ttl: 1000 * 60 * 30 // 30 minutes
        });

        this.channelMood = {
            current: 'neutral',
            score: 0,
            messages: 0,
            lastUpdate: Date.now()
        };
    }

    async analyzeMessage(message, username) {
        try {
            const analysis = await aiService.analyzeMessage(message);
            this.updateUserMood(username, analysis);
            this.updateChannelMood(analysis);
            return analysis;
        } catch (error) {
            logger.error('Error in sentiment analysis:', error);
            return null;
        }
    }

    updateUserMood(username, analysis) {
        const currentMood = this.moodCache.get(username) || {
            history: [],
            average: 0
        };

        currentMood.history.push({
            sentiment: analysis.sentiment,
            emotion: analysis.emotion,
            timestamp: Date.now()
        });

        // Keep last 10 messages
        if (currentMood.history.length > 10) {
            currentMood.history.shift();
        }

        // Update average
        currentMood.average = currentMood.history.reduce((sum, entry) => 
            sum + entry.sentiment, 0) / currentMood.history.length;

        this.moodCache.set(username, currentMood);
    }

    updateChannelMood(analysis) {
        this.channelMood.messages++;
        this.channelMood.score = (this.channelMood.score + analysis.sentiment) / 2;
        this.channelMood.current = this.getSentimentLabel(this.channelMood.score);
        this.channelMood.lastUpdate = Date.now();
    }

    getSentimentLabel(score) {
        if (score > 0.6) return 'very_positive';
        if (score > 0.2) return 'positive';
        if (score < -0.6) return 'very_negative';
        if (score < -0.2) return 'negative';
        return 'neutral';
    }

    getUserMoodSummary(username) {
        const mood = this.moodCache.get(username);
        if (!mood) return null;

        return {
            currentMood: this.getSentimentLabel(mood.average),
            score: mood.average,
            messageCount: mood.history.length,
            dominantEmotion: this.getDominantEmotion(mood.history)
        };
    }

    getDominantEmotion(history) {
        const emotions = history.map(entry => entry.emotion);
        return emotions.reduce((acc, emotion) => {
            acc[emotion] = (acc[emotion] || 0) + 1;
            return acc;
        }, {});
    }

    getChannelMoodSummary() {
        return {
            ...this.channelMood,
            age: Date.now() - this.channelMood.lastUpdate
        };
    }
}

export const sentimentHandler = new SentimentHandler();
