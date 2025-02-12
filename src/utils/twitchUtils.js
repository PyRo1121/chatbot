import logger from './logger.js';

/**
 * Get random viewers from chat
 * @param {string} channel - Channel name
 * @param {number} count - Number of viewers to get
 * @param {Object} context - Twitch context object
 * @returns {Promise<string[]>} Array of viewer usernames
 */
export async function getRandomViewers(channel, count, context) {
    try {
        if (!context?.client) {
            logger.error('No Twitch client provided to getRandomViewers');
            return null;
        }

        // Get current chatters
        const chatters = await context.client.getChannelChatters(channel.replace('#', ''));

        if (!chatters?.data || chatters.data.length < count) {
            logger.debug('Not enough chatters:', {
                channel,
                count,
                actual: chatters?.data?.length,
            });
            return null;
        }

        // Filter out the bot and broadcaster
        const eligibleChatters = chatters.data.filter(chatter =>
            chatter.userName !== process.env.BOT_USERNAME &&
            chatter.userName !== channel.replace('#', '')
        );

        if (eligibleChatters.length < count) {
            logger.debug('Not enough eligible chatters:', {
                channel,
                count,
                eligible: eligibleChatters.length,
            });
            return null;
        }

        // Shuffle array and get random viewers
        const shuffled = [...eligibleChatters]
            .sort(() => 0.5 - Math.random())
            .slice(0, count)
            .map(chatter => chatter.userName);

        return shuffled;
    } catch (error) {
        logger.error('Error getting random viewers:', error);
        return null;
    }
}
