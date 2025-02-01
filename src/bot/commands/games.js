import logger from '../../utils/logger.js';
import { generateResponse } from '../../utils/perplexity.js';

class ChatGames {
  constructor() {
    this.activeGames = new Map();
    this.trivia = {
      active: false,
      question: null,
      answer: null,
      category: null,
      startTime: null,
      participants: new Set(),
    };
    this.wordChain = {
      active: false,
      currentWord: null,
      usedWords: new Set(),
      lastPlayer: null,
      startTime: null,
    };
    this.categories = [
      'Gaming',
      'Movies',
      'Music',
      'Science',
      'History',
      'Geography',
      'Sports',
      'Technology',
    ];
    this.userActivity = new Map();
  }

  trackActivity(username, type) {
    if (!this.userActivity.has(username)) {
      this.userActivity.set(username, {
        commands: 0,
        chat: 0,
        gamesPlayed: 0,
        lastActive: Date.now(),
      });
    }

    const stats = this.userActivity.get(username);
    stats[type === 'command' ? 'commands' : 'chat']++;
    stats.lastActive = Date.now();

    // If they're participating in a game, track it
    if (
      (this.trivia.active && this.trivia.participants.has(username)) ||
      (this.wordChain.active && this.wordChain.lastPlayer === username) ||
      Array.from(this.activeGames.values()).some((game) =>
        game.participants.has(username)
      )
    ) {
      stats.gamesPlayed++;
    }
  }

  // Trivia Game
  async startTrivia(category = null) {
    if (this.trivia.active) {
      return {
        success: false,
        message: 'A trivia game is already in progress!',
      };
    }

    try {
      const selectedCategory =
        category ||
        this.categories[Math.floor(Math.random() * this.categories.length)];
      const prompt = `Generate a challenging trivia question about ${selectedCategory}. Format: QUESTION|||ANSWER`;

      const response = await generateResponse(prompt);
      const [question, answer] = response.split('|||').map((s) => s.trim());

      this.trivia = {
        active: true,
        question,
        answer: answer.toLowerCase(),
        category: selectedCategory,
        startTime: Date.now(),
        participants: new Set(),
      };

      return {
        success: true,
        message: `📚 TRIVIA TIME (${selectedCategory})! ${question} | You have 30 seconds to answer!`,
      };
    } catch (error) {
      logger.error('Error starting trivia:', error);
      return {
        success: false,
        message: 'Failed to start trivia game.',
      };
    }
  }

  checkTrivia(username, answer) {
    if (!this.trivia.active) {
      return null;
    }

    this.trivia.participants.add(username);

    // Check if time limit exceeded (30 seconds)
    if (Date.now() - this.trivia.startTime > 30000) {
      const result = {
        success: true,
        message: `⏰ Time's up! The answer was: ${this.trivia.answer}`,
        gameOver: true,
      };
      this.resetTrivia();
      return result;
    }

    // Check answer
    if (answer.toLowerCase().includes(this.trivia.answer)) {
      const timeTaken = ((Date.now() - this.trivia.startTime) / 1000).toFixed(
        1
      );
      const result = {
        success: true,
        message: `🎯 ${username} got it right in ${timeTaken} seconds! The answer was: ${this.trivia.answer}`,
        winner: username,
        gameOver: true,
      };
      this.resetTrivia();
      return result;
    }

    return {
      success: false,
      message: null, // Don't reveal wrong answers
    };
  }

  resetTrivia() {
    this.trivia = {
      active: false,
      question: null,
      answer: null,
      category: null,
      startTime: null,
      participants: new Set(),
    };
  }

  // Word Chain Game
  startWordChain() {
    if (this.wordChain.active) {
      return {
        success: false,
        message: 'A word chain game is already in progress!',
      };
    }

    const startWords = ['stream', 'gaming', 'twitch', 'player', 'online'];
    const word = startWords[Math.floor(Math.random() * startWords.length)];

    this.wordChain = {
      active: true,
      currentWord: word,
      usedWords: new Set([word]),
      lastPlayer: null,
      startTime: Date.now(),
    };

    return {
      success: true,
      message: `🔤 WORD CHAIN GAME! Start with the word: ${word} | Reply with a word that starts with the last letter! Example: ${word} ➡️ ${word.slice(-1)}ame`,
    };
  }

  checkWordChain(username, word) {
    if (!this.wordChain.active) {
      return null;
    }

    const cleanWord = word.toLowerCase().trim();

    // Basic word validation
    if (cleanWord.length < 3) {
      return {
        success: false,
        message: `@${username}, words must be at least 3 letters long!`,
      };
    }

    // Check if word starts with last letter of current word
    if (cleanWord[0] !== this.wordChain.currentWord.slice(-1)) {
      return {
        success: false,
        message: `@${username}, your word must start with the letter "${this.wordChain.currentWord.slice(-1)}"!`,
      };
    }

    // Check if word was already used
    if (this.wordChain.usedWords.has(cleanWord)) {
      return {
        success: false,
        message: `@${username}, "${word}" was already used! Try another word!`,
      };
    }

    // Valid word
    this.wordChain.currentWord = cleanWord;
    this.wordChain.usedWords.add(cleanWord);
    this.wordChain.lastPlayer = username;

    // Check if game should end (after 5 minutes or 30 words)
    if (
      Date.now() - this.wordChain.startTime > 300000 ||
      this.wordChain.usedWords.size >= 30
    ) {
      const result = {
        success: true,
        message: `🎮 Word Chain ends! Amazing job everyone! You made a chain of ${this.wordChain.usedWords.size} words!`,
        gameOver: true,
      };
      this.resetWordChain();
      return result;
    }

    return {
      success: true,
      message: `✨ @${username} plays: ${cleanWord} | Next word must start with: ${cleanWord.slice(-1)}`,
    };
  }

  resetWordChain() {
    this.wordChain = {
      active: false,
      currentWord: null,
      usedWords: new Set(),
      lastPlayer: null,
      startTime: null,
    };
  }

  // Mini Games
  async startMiniGame(type) {
    if (this.activeGames.has(type)) {
      return {
        success: false,
        message: 'This game is already in progress!',
      };
    }

    let game;
    switch (type) {
      case 'scramble':
        game = this.createWordScramble();
        break;
      case 'riddle':
        game = await this.createRiddle();
        break;
      default:
        return {
          success: false,
          message: 'Unknown game type.',
        };
    }

    this.activeGames.set(type, {
      ...game,
      startTime: Date.now(),
      participants: new Set(),
    });

    return {
      success: true,
      message: game.prompt,
    };
  }

  createWordScramble() {
    const words = [
      'streamer',
      'broadcast',
      'community',
      'moderator',
      'emote',
      'subscriber',
    ];
    const word = words[Math.floor(Math.random() * words.length)];
    const scrambled = word
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');

    return {
      type: 'scramble',
      word,
      prompt: `🔤 WORD SCRAMBLE! Unscramble this word: ${scrambled}`,
    };
  }

  async createRiddle() {
    const prompt =
      'Generate a short, fun riddle about streaming or gaming. Format: RIDDLE|||ANSWER';
    const response = await generateResponse(prompt);
    const [riddle, answer] = response.split('|||').map((s) => s.trim());

    return {
      type: 'riddle',
      answer: answer.toLowerCase(),
      prompt: `🤔 RIDDLE TIME! ${riddle}`,
    };
  }

  checkMiniGame(type, username, answer) {
    const game = this.activeGames.get(type);
    if (!game) {
      return null;
    }

    game.participants.add(username);

    // Check if time limit exceeded (60 seconds)
    if (Date.now() - game.startTime > 60000) {
      const result = {
        success: true,
        message: `⏰ Time's up! The answer was: ${game.word || game.answer}`,
        gameOver: true,
      };
      this.activeGames.delete(type);
      return result;
    }

    // Check answer
    const correct =
      type === 'scramble'
        ? answer.toLowerCase() === game.word
        : answer.toLowerCase().includes(game.answer);

    if (correct) {
      const timeTaken = ((Date.now() - game.startTime) / 1000).toFixed(1);
      const result = {
        success: true,
        message: `🎯 ${username} got it right in ${timeTaken} seconds! The answer was: ${game.word || game.answer}`,
        winner: username,
        gameOver: true,
      };
      this.activeGames.delete(type);
      return result;
    }

    return {
      success: false,
      message: null, // Don't reveal wrong answers
    };
  }
}

const chatGames = new ChatGames();
export default chatGames;

export function handleStartTrivia(username, args, userLevel) {
  if (userLevel !== 'mod' && userLevel !== 'broadcaster') {
    return {
      success: false,
      message: 'Only moderators can start trivia games!',
    };
  }

  const category = args.length > 0 ? args.join(' ') : null;
  return chatGames.startTrivia(category);
}

export function handleStartWordChain(username, args, userLevel) {
  if (userLevel !== 'mod' && userLevel !== 'broadcaster') {
    return {
      success: false,
      message: 'Only moderators can start word chain games!',
    };
  }

  return chatGames.startWordChain();
}

export function handleStartMiniGame(username, args, userLevel) {
  if (userLevel !== 'mod' && userLevel !== 'broadcaster') {
    return {
      success: false,
      message: 'Only moderators can start mini games!',
    };
  }

  if (args.length < 1) {
    return {
      success: false,
      message: 'Usage: !minigame [scramble|riddle]',
    };
  }

  return chatGames.startMiniGame(args[0].toLowerCase());
}

export function handleAnswer(username, message) {
  // Check all active games for answers
  if (chatGames.trivia.active) {
    const result = chatGames.checkTrivia(username, message);
    if (result) {
      return result;
    }
  }

  if (chatGames.wordChain.active) {
    const result = chatGames.checkWordChain(username, message);
    if (result) {
      return result;
    }
  }

  for (const [type] of chatGames.activeGames) {
    const result = chatGames.checkMiniGame(type, username, message);
    if (result) {
      return result;
    }
  }

  return null;
}
