import { analyzeSentiment } from '../utils/perplexity.js';
import logger from '../utils/logger.js';

class AdvancedModeration {
  constructor() {
    this.shadowbannedUsers = new Set();
    this.moderationRules = {
      phishingKeywords: ['free', 'gift', 'click', 'http', 'www'],
    };
  }

  async analyzeMessage(message, user) {
    // Skip moderation for subs/vip/mods
    if (user.isSubscriber || user.isVip || user.isMod) {
      return null;
    }

    // Check if user is shadowbanned
    if (this.shadowbannedUsers.has(user.username)) {
      return null; // Silently ignore messages from shadowbanned users
    }

    // Check message sentiment
    const sentiment = await analyzeSentiment(message);
    if (sentiment.toxicityScore > 0.9) {
      // Higher threshold for less strict moderation
      return {
        action: 'timeout',
        reason: 'Severe toxicity detected',
        duration: 600, // 10 minute timeout
      };
    }

    // Check for phishing attempts
    const phishingResult = this.detectPhishing(message);
    if (phishingResult) {
      return phishingResult;
    }

    return null;
  }

  detectPhishing(message) {
    // Check for phishing keywords
    const lowerMessage = message.toLowerCase();
    const hasPhishingKeywords = this.moderationRules.phishingKeywords.some((keyword) =>
      lowerMessage.includes(keyword)
    );

    if (hasPhishingKeywords && (lowerMessage.includes('http') || lowerMessage.includes('www'))) {
      return {
        action: 'ban',
        reason: 'Potential phishing attempt detected',
      };
    }
    return null;
  }

  shadowbanUser(username) {
    this.shadowbannedUsers.add(username);
    logger.info({
      type: 'shadowban',
      username,
      timestamp: new Date().toISOString(),
    });
  }
}

export default AdvancedModeration;
