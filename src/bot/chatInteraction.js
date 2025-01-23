import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import logger from '../utils/logger.js';
import { generateResponse } from '../utils/openai.js';

class ChatInteraction {
  constructor() {
    this.dbPath = join(process.cwd(), 'src/bot/chat_learning.json');
    this.data = this.loadData();
    this.lastInteraction = 0;
    this.COOLDOWN = 15000; // 15 seconds minimum between interactions
    this.MAX_COOLDOWN = 30000; // 30 seconds maximum
    this.INTERACTION_CHANCE = 0.3; // 30% chance to interact when cooldown is up
  }

  loadData() {
    try {
      if (existsSync(this.dbPath)) {
        const data = readFileSync(this.dbPath, 'utf8');
        return JSON.parse(data);
      }
      // Initialize with default structure
      const defaultData = {
        userInteractions: {}, // Track user interaction success
        keywords: {}, // Track keywords that trigger good interactions
        timePatterns: {}, // Track successful interaction times
        messagePatterns: [], // Common patterns that work well
        responses: {
          // Categories of witty responses
          greetings: [
            "What's cookin', good lookin'? 🔥",
            "Hey chat, missed me? I've been practicing my dad jokes! 👋",
            "I'm back! Did anyone notice I was gone? No? Just as planned! 😎",
          ],
          reactions: [
            "That's what she said! ...wait, can I say that? 👀",
            'Weird flex but ok! 💪',
            "Chat moving so fast no one will notice I'm actually a potato 🥔",
          ],
          jokes: [
            "Why don't bots tell dad jokes? Because they have data banks instead! 🤖",
            "I'm not saying I'm Batman, but has anyone ever seen me and Batman in the same room? 🦇",
            "I'm so good at sleeping, I can do it with my processors closed! 😴",
          ],
          hype: [
            'LETS GOOOOO! 🚀',
            "Chat's energy is over 9000! 💥",
            "You're all breathtaking! Yes, even you lurkers! 👻",
          ],
        },
      };
      this.saveData(defaultData);
      return defaultData;
    } catch (error) {
      logger.error('Error loading chat interaction data:', error);
      return {
        userInteractions: {},
        keywords: {},
        timePatterns: {},
        messagePatterns: [],
        responses: {
          greetings: [],
          reactions: [],
          jokes: [],
          hype: [],
        },
      };
    }
  }

  saveData(data = this.data) {
    try {
      writeFileSync(this.dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error('Error saving chat interaction data:', error);
    }
  }

  // Record a successful interaction
  recordSuccess(username, message, category) {
    if (!this.data.userInteractions[username]) {
      this.data.userInteractions[username] = {
        successCount: 0,
        categories: {},
      };
    }
    this.data.userInteractions[username].successCount++;
    this.data.userInteractions[username].categories[category] =
      (this.data.userInteractions[username].categories[category] || 0) + 1;

    // Record keywords
    const words = message.toLowerCase().split(' ');
    words.forEach((word) => {
      if (word.length > 3) {
        // Ignore very short words
        this.data.keywords[word] = (this.data.keywords[word] || 0) + 1;
      }
    });

    // Record time pattern (hour of day)
    const hour = new Date().getHours();
    this.data.timePatterns[hour] = (this.data.timePatterns[hour] || 0) + 1;

    this.saveData();
  }

  // Get a witty response based on message context
  async getWittyResponse(message, username) {
    const now = Date.now();
    if (now - this.lastInteraction < this.COOLDOWN) {
      return null;
    }

    // Random chance to interact when cooldown is up
    if (Math.random() > this.INTERACTION_CHANCE) {
      return null;
    }

    try {
      // Analyze message for interaction opportunity
      const prompt = `Analyze this chat message and determine if it's a good opportunity for a witty bot response. Consider:
1. Is it engaging/interesting?
2. Would a witty response add to the conversation?
3. Is it appropriate for a fun response?

Message: "${message}"

Respond ONLY with a category if we should respond, or "none" if we should skip:
- greeting (for welcomes/hellos)
- reaction (for reacting to statements/events)
- joke (for opportunities to be funny)
- hype (for exciting moments)
- none (skip responding)`;

      const category = await generateResponse(prompt);
      const cleanCategory = category.toLowerCase().trim();

      if (cleanCategory === 'none' || !this.data.responses[cleanCategory]) {
        return null;
      }

      // Get responses for the category
      const responses = this.data.responses[cleanCategory];
      const response = responses[Math.floor(Math.random() * responses.length)];

      // Update interaction time
      this.lastInteraction = now;

      // Record this as a successful interaction
      this.recordSuccess(username, message, cleanCategory);

      // Dynamically adjust cooldown based on chat activity
      const hour = new Date().getHours();
      const hourActivity = this.data.timePatterns[hour] || 0;
      // More activity = longer cooldown, up to MAX_COOLDOWN
      this.COOLDOWN = Math.min(this.MAX_COOLDOWN, 15000 + Math.floor(hourActivity / 10) * 1000);

      return response;
    } catch (error) {
      logger.error('Error generating witty response:', error);
      return null;
    }
  }

  // Add a new response to a category
  addResponse(category, response) {
    if (this.data.responses[category]) {
      if (!this.data.responses[category].includes(response)) {
        this.data.responses[category].push(response);
        this.saveData();
      }
    }
  }

  // Get interaction stats for analysis
  getStats() {
    return {
      totalInteractions: Object.values(this.data.userInteractions).reduce(
        (sum, user) => sum + user.successCount,
        0
      ),
      popularKeywords: Object.entries(this.data.keywords)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      activeHours: Object.entries(this.data.timePatterns)
        .sort((a, b) => b[1] - a[1])
        .map(([hour, count]) => ({ hour: parseInt(hour), count })),
    };
  }
}

const chatInteraction = new ChatInteraction();
export default chatInteraction;
