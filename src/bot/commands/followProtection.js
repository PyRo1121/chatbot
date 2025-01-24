import followProtection from '../followProtection.js';
import logger from '../../utils/logger.js';

export const followProtectionCommands = {
  // View suspicious followers
  async suspicious(client, channel, user, message, isBroadcaster) {
    // Wait for suspicious followers data to be loaded
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (!isBroadcaster) {
      return {
        success: false,
        message: 'This command is only available to the broadcaster',
      };
    }

    const followers = followProtection.getSuspiciousFollowers();
    if (followers.length === 0) {
      return {
        success: true,
        message: 'No suspicious followers detected',
      };
    }

    // Format the list of suspicious followers
    const formattedFollowers = followers
      .slice(0, 5) // Show only the 5 most recent
      .map(
        (f) =>
          `${f.username} (${f.reason}, Age: ${f.accountAge}, Detected: ${new Date(
            f.timestamp
          ).toLocaleString()})`
      )
      .join(' | ');

    return {
      success: true,
      message: `Recent suspicious followers (${followers.length} total): ${formattedFollowers}`,
    };
  },

  // Clear suspicious followers list
  async clear(client, channel, user, message, isBroadcaster) {
    // Wait for clear operation to complete
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (!isBroadcaster) {
      return {
        success: false,
        message: 'This command is only available to the broadcaster',
      };
    }

    const count = followProtection.clearSuspiciousFollowers();
    logger.info(`Cleared ${count} suspicious followers`);
    return {
      success: true,
      message: `Cleared ${count} suspicious followers from tracking`,
    };
  },

  // View follow protection settings
  async settings(client, channel, user, message, isBroadcaster) {
    // Wait for settings to be loaded
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (!isBroadcaster) {
      return {
        success: false,
        message: 'This command is only available to the broadcaster',
      };
    }

    const config = followProtection.getConfig();
    return {
      success: true,
      message: `Follow Protection Settings | Min Account Age: ${config.minAccountAge}h | Max Follows/Min: ${config.maxFollowsPerMinute} | Silent Mode Duration: ${config.silentModeDuration}m`,
    };
  },
};
