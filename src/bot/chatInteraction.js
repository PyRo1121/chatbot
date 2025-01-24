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
    this.contextMemory = new Map(); // Short-term memory for context
    this.MEMORY_RETENTION = 1000 * 60 * 30; // 30 minutes memory retention
    this.chatMood = {
      sentiment: 0, // -1 to 1 scale
      energy: 0.5, // 0 to 1 scale
      lastUpdate: Date.now(),
    };
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
        chatPatterns: {
          topics: {}, // Popular discussion topics
          engagement: {}, // Messages that got high engagement
          sentiment: {}, // Emotional patterns in chat
          userStyles: {}, // Individual user communication styles
        },
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
        chatPatterns: {
          topics: {},
          engagement: {},
          sentiment: {},
          userStyles: {},
        },
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

    // Update chat mood
    await this.updateChatMood(message);

    // Get user context
    const userContext = this.getUserContext(username);

    // Clean old memories
    this.cleanOldMemories();

    try {
      // Analyze message for interaction opportunity
      const prompt = `Analyze this chat message and determine how to respond. Consider:
1. Is it a question that needs a helpful answer?
2. Is it an opportunity for a witty response?
3. Is it appropriate for interaction?

Chat Context:
- Current Mood: ${this.getMoodString()}
- Energy Level: ${this.getEnergyLevelString()}
- User History: ${JSON.stringify(userContext)}
- Recent Topics: ${Array.from(this.contextMemory.values())
        .slice(-3)
        .map((m) => m.message)
        .join(', ')}

Message: "${message}"

Respond ONLY with a category:
- question (for questions needing answers)
- greeting (for welcomes/hellos)
- reaction (for reacting to statements/events)
- joke (for opportunities to be funny)
- hype (for exciting moments)
- none (skip responding)`;

      const category = await generateResponse(prompt);
      const cleanCategory = category.toLowerCase().trim();

      if (cleanCategory === 'none') {
        return null;
      }

      let response;
      if (cleanCategory === 'question') {
        // Generate a helpful answer for questions
        const answerPrompt = `Answer this Twitch chat question in a friendly and concise way: "${message}"
Keep the answer short and entertaining while being helpful.`;
        response = await generateResponse(
          answerPrompt,
          'You are a knowledgeable and fun Twitch bot. Keep answers short and entertaining while being accurate and helpful.'
        );
      } else if (this.data.responses[cleanCategory]) {
        // Get witty responses for other categories
        const responses = this.data.responses[cleanCategory];
        response = responses[Math.floor(Math.random() * responses.length)];
      } else {
        return null;
      }

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

  getMoodString() {
    if (this.chatMood.sentiment > 0) {
      return 'Positive';
    }
    if (this.chatMood.sentiment < 0) {
      return 'Negative';
    }
    return 'Neutral';
  }

  getEnergyLevelString() {
    if (this.chatMood.energy > 0.7) {
      return 'High';
    }
    if (this.chatMood.energy < 0.3) {
      return 'Low';
    }
    return 'Medium';
  }

  async updateChatMood(message) {
    try {
      const prompt = `Analyze this chat message for mood and energy. Respond with JSON only:
{
  "sentiment": number between -1 and 1,
  "energy": number between 0 and 1
}

Message: "${message}"`;

      const response = await generateResponse(prompt);
      const analysis = JSON.parse(response);

      // Smooth the mood changes (70% old, 30% new)
      this.chatMood.sentiment = this.chatMood.sentiment * 0.7 + analysis.sentiment * 0.3;
      this.chatMood.energy = this.chatMood.energy * 0.7 + analysis.energy * 0.3;
      this.chatMood.lastUpdate = Date.now();

      // Update chat patterns
      if (!this.data.chatPatterns.sentiment[this.getMoodString()]) {
        this.data.chatPatterns.sentiment[this.getMoodString()] = 0;
      }
      this.data.chatPatterns.sentiment[this.getMoodString()]++;
      this.saveData();
    } catch (error) {
      logger.error('Error updating chat mood:', error);
    }
  }

  getUserContext(username) {
    const userInteractions = this.data.userInteractions[username] || {
      successCount: 0,
      categories: {},
    };

    // Get user's preferred interaction categories
    const preferredCategories = Object.entries(userInteractions.categories || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([category]) => category);

    // Get user's recent messages from memory
    const recentMessages = Array.from(this.contextMemory.values())
      .filter((m) => m.username === username)
      .slice(-3)
      .map((m) => m.message);

    return {
      interactionCount: userInteractions.successCount,
      preferredCategories,
      recentMessages,
      style: this.data.chatPatterns.userStyles[username] || 'unknown',
    };
  }

  cleanOldMemories() {
    const now = Date.now();
    for (const [key, value] of this.contextMemory.entries()) {
      if (now - value.timestamp > this.MEMORY_RETENTION) {
        this.contextMemory.delete(key);
      }
    }
  }

  // Store new message in context memory
  storeMessage(username, message) {
    const messageId = Date.now();
    this.contextMemory.set(messageId, {
      username,
      message,
      timestamp: Date.now(),
    });

    // Analyze and update user's communication style
    this.analyzeUserStyle(username, message);

    // Update topics
    const words = message.toLowerCase().split(' ');
    const topics = words.filter((word) => word.length > 3);
    topics.forEach((topic) => {
      if (!this.data.chatPatterns.topics[topic]) {
        this.data.chatPatterns.topics[topic] = 0;
      }
      this.data.chatPatterns.topics[topic]++;
    });

    this.saveData();
  }

  // Analyze user's communication style
  async analyzeUserStyle(username, message) {
    try {
      const prompt = `Analyze this chat message for communication style. Respond with ONE word only:
- casual
- formal
- enthusiastic
- sarcastic
- supportive
- aggressive
- humorous
- informative

Message: "${message}"`;

      const style = await generateResponse(prompt);
      const cleanStyle = style.toLowerCase().trim();

      if (!this.data.chatPatterns.userStyles[username]) {
        this.data.chatPatterns.userStyles[username] = cleanStyle;
      } else {
        // Gradually update style (80% old, 20% new if style changes)
        if (this.data.chatPatterns.userStyles[username] !== cleanStyle) {
          const randomChange = Math.random() < 0.2;
          if (randomChange) {
            this.data.chatPatterns.userStyles[username] = cleanStyle;
          }
        }
      }
    } catch (error) {
      logger.error('Error analyzing user style:', error);
    }
  }

  // Get interaction stats for analysis
  getStats() {
    const moodDistribution = Object.entries(this.data.chatPatterns.sentiment)
      .map(([mood, count]) => ({ mood, count }))
      .sort((a, b) => b.count - a.count);

    const topTopics = Object.entries(this.data.chatPatterns.topics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));

    const userStyles = Object.entries(this.data.chatPatterns.userStyles).reduce(
      (acc, [, style]) => {
        acc[style] = (acc[style] || 0) + 1;
        return acc;
      },
      {}
    );

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
      chatMood: {
        current: {
          sentiment: this.getMoodString(),
          energy: this.getEnergyLevelString(),
        },
        distribution: moodDistribution,
      },
      topTopics,
      userStyles,
      memorySize: this.contextMemory.size,
    };
  }
}

const chatInteraction = new ChatInteraction();
export default chatInteraction;
