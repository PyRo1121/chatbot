import logger from '../utils/logger.js';

class ClipService {
    constructor() {
        this.clipTriggers = {
            chatIntensity: {
                threshold: 10,
                timeWindow: 60000 // 1 minute
            },
            emotionSpike: {
                threshold: 0.8,
                minMessages: 5
            },
            keywordTriggers: new Set([
                'amazing',
                'incredible',
                'poggers',
                'clip it',
                'omg'
            ])
        };

        this.recentClips = new Map();
        this.CLIP_COOLDOWN = 5 * 60 * 1000; // 5 minutes
    }

    async handleHighlight(highlight, twitchClient) {
        if (!this.canCreateClip(highlight.type)) {
            return null;
        }

        try {
            const clip = await this.createClip(twitchClient, {
                title: this.generateClipTitle(highlight),
                category: highlight.type
            });

            if (clip) {
                this.recentClips.set(clip.id, {
                    timestamp: Date.now(),
                    highlight
                });
            }

            return clip;
        } catch (error) {
            logger.error('Error creating clip:', error);
            return null;
        }
    }

    canCreateClip(type) {
        const lastClip = Array.from(this.recentClips.values())
            .find(clip => clip.highlight.type === type);

        return !lastClip || Date.now() - lastClip.timestamp > this.CLIP_COOLDOWN;
    }

    generateClipTitle(highlight) {
        const prefix = {
            chat_highlight: '🔥 Chat Goes Wild -',
            emotion_spike: '😮 Epic Moment -',
            keyword_trigger: '📌 Highlighted by Chat -'
        }[highlight.type] || '📹 Stream Highlight -';

        return `${prefix} ${new Date().toLocaleTimeString()}`;
    }

    async createClip(twitchClient, options) {
        // Implementation depends on your Twitch API wrapper
        // This is a placeholder for the actual implementation
        try {
            const clip = await twitchClient.clips.createClip({
                channel: options.channel,
                title: options.title
            });

            logger.info('Clip created:', clip);
            return clip;
        } catch (error) {
            logger.error('Error creating clip:', error);
            return null;
        }
    }
}

export const clipService = new ClipService();
