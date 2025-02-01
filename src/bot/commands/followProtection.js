import followProtection from '../followProtection.js';
import logger from '../../utils/logger.js';

export async function handleSuspiciousFollowers(client, channel, user) {
  try {
    const suspicious = await followProtection.getSuspiciousFollowers();
    if (suspicious.length === 0) {
      return 'No suspicious followers detected!';
    }

    const recentSuspicious = suspicious
      .slice(-3)
      .map((f) => `${f.username} (${f.reason})`)
      .join(', ');
    return `Recent suspicious followers: ${recentSuspicious} | Total: ${suspicious.length}`;
  } catch (error) {
    logger.error('Error getting suspicious followers:', error);
    return 'Error retrieving suspicious followers. Please try again later.';
  }
}

export async function handleClearSuspicious(client, channel, user) {
  try {
    const cleared = await followProtection.clearSuspiciousFollowers();
    return `Cleared ${cleared} suspicious followers from the list!`;
  } catch (error) {
    logger.error('Error clearing suspicious followers:', error);
    return 'Error clearing suspicious followers. Please try again later.';
  }
}

export async function handleFollowSettings(client, channel, user, args) {
  try {
    if (!args || args.length === 0) {
      const settings = await followProtection.getSettings();
      return `Current Follow Protection Settings: Min Account Age: ${settings.minAccountAge}d | Follow Rate Limit: ${settings.followRateLimit}/h | Enabled: ${settings.enabled}`;
    }

    const [setting, value] = args;
    switch (setting.toLowerCase()) {
      case 'age':
        if (isNaN(value)) {
          return 'Please provide a valid number of days for minimum account age!';
        }
        await followProtection.updateSettings({
          minAccountAge: parseInt(value),
        });
        return `Minimum account age updated to ${value} days!`;

      case 'rate':
        if (isNaN(value)) {
          return 'Please provide a valid number for follow rate limit!';
        }
        await followProtection.updateSettings({
          followRateLimit: parseInt(value),
        });
        return `Follow rate limit updated to ${value} follows per hour!`;

      case 'enable':
        await followProtection.updateSettings({ enabled: true });
        return 'Follow protection enabled!';

      case 'disable':
        await followProtection.updateSettings({ enabled: false });
        return 'Follow protection disabled!';

      default:
        return 'Invalid setting! Available options: age [days], rate [follows/hour], enable, disable';
    }
  } catch (error) {
    logger.error('Error handling follow settings:', error);
    return 'Error updating follow protection settings. Please try again later.';
  }
}

export async function handleFollowStats(client, channel, user) {
  try {
    const stats = await followProtection.getStats();
    return `Follow Protection Stats: Suspicious: ${stats.suspicious} | Blocked: ${stats.blocked} | False Positives: ${stats.falsePositives} | Total Follows: ${stats.totalFollows}`;
  } catch (error) {
    logger.error('Error getting follow stats:', error);
    return 'Error retrieving follow protection stats. Please try again later.';
  }
}

export async function handleFollowCheck(client, channel, user, args) {
  try {
    if (!args || args.length === 0) {
      return 'Please provide a username to check!';
    }

    const username = args[0].replace('@', '');
    const check = await followProtection.checkFollower(username);

    if (check.suspicious) {
      return `@${username} was flagged as suspicious: ${check.reason}`;
    }

    return `@${username} passed all follow protection checks!`;
  } catch (error) {
    logger.error('Error checking follower:', error);
    return 'Error checking follower. Please try again later.';
  }
}

export async function handleFollowMode(client, channel, user, args) {
  try {
    if (!args || args.length === 0) {
      const mode = await followProtection.getFollowMode();
      return `Current follow mode: ${mode.enabled ? mode.type : 'disabled'} ${
        mode.enabled ? `(${mode.duration}s)` : ''
      }`;
    }

    const [type, duration] = args;
    if (type.toLowerCase() === 'off') {
      await followProtection.setFollowMode({ enabled: false });
      return 'Follow mode disabled!';
    }

    if (!['followers', 'subscribers'].includes(type.toLowerCase())) {
      return 'Invalid follow mode! Options: followers, subscribers, off';
    }

    const followDuration = duration ? parseInt(duration) : 300;
    await followProtection.setFollowMode({
      enabled: true,
      type: type.toLowerCase(),
      duration: followDuration,
    });

    return `Follow mode set to ${type} for ${followDuration} seconds!`;
  } catch (error) {
    logger.error('Error handling follow mode:', error);
    return 'Error updating follow mode. Please try again later.';
  }
}
