import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse';
import logger from '../utils/logger.js';

const ANALYTICS_JSON_PATH = path.join(process.cwd(), 'src/bot/data/analytics.json');
const ANALYTICS_CSV_PATH = path.join(process.cwd(), 'src/bot/analytics.csv');

class AnalyticsData {
    constructor() {
        this.data = null;
        this.lastUpdate = null;
    }

    async initialize() {
        try {
            // Create data directory if it doesn't exist
            const dataDir = path.dirname(ANALYTICS_JSON_PATH);
            await fs.mkdir(dataDir, { recursive: true });

            // Try to load existing JSON data
            try {
                const jsonData = await fs.readFile(ANALYTICS_JSON_PATH, 'utf-8');
                this.data = JSON.parse(jsonData);
                this.lastUpdate = new Date(this.data.lastUpdate);
            } catch (error) {
                // If JSON doesn't exist or is invalid, convert CSV
                await this.convertCSVToJSON();
            }

            // Schedule daily updates
            this.scheduleDailyUpdate();
            logger.info('Analytics data initialized successfully');
        } catch (error) {
            logger.error('Error initializing analytics data:', error);
            throw error;
        }
    }

    async convertCSVToJSON() {
        try {
            const csvContent = await fs.readFile(ANALYTICS_CSV_PATH, 'utf-8');
            const records = await new Promise((resolve, reject) => {
                parse(csvContent, {
                    columns: true,
                    skip_empty_lines: true,
                }, (err, data) => {
                    if (err) { reject(err); }
                    else { resolve(data); }
                });
            });

            // Convert CSV records to our desired format
            const processedData = records.map(record => ({
                date: record.Date,
                averageViewers: parseFloat(record['Average Viewers']) || 0,
                maxViewers: parseInt(record['Max Viewers']) || 0,
                minutesStreamed: parseInt(record['Minutes Streamed']) || 0,
                follows: parseInt(record.Follows) || 0,
                uniqueViewers: parseInt(record['Unique Viewers']) || 0,
                chatters: parseInt(record.Chatters) || 0,
                chatMessages: parseInt(record['Chat Messages']) || 0,
                engagedViewers: parseInt(record['Engaged Viewers']) || 0,
                newEngagedViewers: parseInt(record['New Engaged Viewers']) || 0,
                returningEngagedViewers: parseInt(record['Returning Engaged Viewers']) || 0,
            }));

            // Calculate aggregate stats
            const stats = this.calculateAggregateStats(processedData);

            // Save as JSON
            this.data = {
                lastUpdate: new Date().toISOString(),
                historicalData: processedData,
                aggregateStats: stats,
            };

            await this.saveToJSON();
            this.lastUpdate = new Date();
            logger.info('Successfully converted CSV to JSON');
        } catch (error) {
            logger.error('Error converting CSV to JSON:', error);
            throw error;
        }
    }

    calculateAggregateStats(data) {
        const activeStreams = data.filter(d => d.minutesStreamed > 0);
        const last30Days = data.slice(-30);
        const activeStreamsLast30 = last30Days.filter(d => d.minutesStreamed > 0);

        return {
            allTime: {
                avgViewers: this.average(activeStreams.map(d => d.averageViewers)),
                peakViewers: Math.max(...data.map(d => d.maxViewers)),
                totalStreams: activeStreams.length,
                totalStreamMinutes: activeStreams.reduce((sum, d) => sum + d.minutesStreamed, 0),
                totalFollows: data.reduce((sum, d) => sum + d.follows, 0),
                avgEngagement: this.average(activeStreams.map(d => d.engagedViewers / (d.uniqueViewers || 1))),
            },
            last30Days: {
                avgViewers: this.average(activeStreamsLast30.map(d => d.averageViewers)),
                peakViewers: Math.max(...last30Days.map(d => d.maxViewers)),
                totalStreams: activeStreamsLast30.length,
                totalStreamMinutes: activeStreamsLast30.reduce((sum, d) => sum + d.minutesStreamed, 0),
                totalFollows: last30Days.reduce((sum, d) => sum + d.follows, 0),
                avgEngagement: this.average(activeStreamsLast30.map(d => d.engagedViewers / (d.uniqueViewers || 1))),
            },
        };
    }

    average(numbers) {
        const validNumbers = numbers.filter(n => !isNaN(n) && n !== null);
        return validNumbers.length ? validNumbers.reduce((sum, n) => sum + n, 0) / validNumbers.length : 0;
    }

    async saveToJSON() {
        try {
            await fs.writeFile(
                ANALYTICS_JSON_PATH,
                JSON.stringify(this.data, null, 2),
                'utf-8'
            );
            logger.info('Analytics data saved to JSON');
        } catch (error) {
            logger.error('Error saving analytics data to JSON:', error);
            throw error;
        }
    }

    async updateWithTwitchData(twitchData) {
        if (!this.data) {
            throw new Error('Analytics data not initialized');
        }

        const today = new Date().toISOString().split('T')[0];
        const todayData = {
            date: today,
            ...twitchData,
        };

        // Update or add today's data
        const todayIndex = this.data.historicalData.findIndex(d => d.date.startsWith(today));
        if (todayIndex >= 0) {
            this.data.historicalData[todayIndex] = todayData;
        } else {
            this.data.historicalData.push(todayData);
        }

        // Recalculate aggregate stats
        this.data.aggregateStats = this.calculateAggregateStats(this.data.historicalData);
        this.data.lastUpdate = new Date().toISOString();

        // Save updates
        await this.saveToJSON();
    }

    scheduleDailyUpdate() {
        // Check for updates every hour
        setInterval(async () => {
            const now = new Date();
            const lastUpdateTime = this.lastUpdate || new Date(0);
            if (now - lastUpdateTime > 24 * 60 * 60 * 1000) {
                try {
                    await this.convertCSVToJSON();
                    logger.info('Completed daily analytics update');
                } catch (error) {
                    logger.error('Error in daily analytics update:', error);
                }
            }
        }, 60 * 60 * 1000);
    }

    getStats() {
        return this.data?.aggregateStats || null;
    }

    getRecentData(days = 30) {
        if (!this.data?.historicalData) {
            return [];
        }
        return this.data.historicalData.slice(-days);
    }
}

export default new AnalyticsData(); 