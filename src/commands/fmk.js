import { getRandomViewers } from '../utils/twitchUtils.js';
import logger from '../utils/logger.js';

export const FMKCommand = {
    name: 'fmk',
    description: 'Play a game of FMK with random chatters',
    cooldown: 30,
    async execute(channel, user, args, twitchClient) {
        try {
            // Get 3 random viewers from chat
            const viewers = await getRandomViewers(channel, 3, twitchClient);

            if (!viewers || viewers.length < 3) {
                return 'Not enough viewers in chat to play FMK! Need at least 3 chatters.';
            }

            // Create a fun response template
            const options = ['Fuck', 'Marry', 'Kill'];
            const shuffled = [...options].sort(() => 0.5 - Math.random());

            return `@${user.username} rolls the FMK dice: ${viewers[0]} - ${shuffled[0]}, ${viewers[1]} - ${shuffled[1]}, ${viewers[2]} - ${shuffled[2]} 🎲`;
        } catch (error) {
            logger.error('Error in FMK command:', error);
            return 'Error executing FMK command! Try again later.';
        }
    },
};

export default FMKCommand;
