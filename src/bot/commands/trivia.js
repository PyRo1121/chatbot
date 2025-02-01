import {
  startTrivia as startTriviaGame,
  handleAnswer,
  endTrivia as endTriviaGame,
} from '../triviaManager.js';
import { categories } from '../../utils/trivia.js';
import logger from '../../utils/logger.js';

export async function startTrivia(client, channel, user, args) {
  try {
    // Check if user has permission (mod or broadcaster)
    if (!user.isMod && !user.isBroadcaster) {
      return 'Only moderators and the broadcaster can start trivia games!';
    }

    const category =
      args && args.length > 0 ? args[0].toLowerCase() : 'general';

    // Start the game and get formatted question
    const response = await startTriviaGame(channel, category);
    return response;
  } catch (error) {
    logger.error('Error in trivia command:', error);
    return 'Error starting trivia game. Please try again.';
  }
}

export async function handleTriviaAnswer(client, channel, user, args) {
  try {
    if (!args || args.length === 0) {
      return 'Please provide an answer (A/B/C/D)!';
    }

    const answer = args[0].toUpperCase();
    const response = await handleAnswer(channel, user.username, answer);
    return response; // Will be null if answer was accepted
  } catch (error) {
    logger.error('Error handling trivia answer:', error);
    return 'Error processing answer. Please try again.';
  }
}

export async function endTrivia(client, channel, user) {
  try {
    // Check if user has permission (mod or broadcaster)
    if (!user.isMod && !user.isBroadcaster) {
      return 'Only moderators and the broadcaster can end trivia games!';
    }

    const response = await endTriviaGame(channel);
    return response;
  } catch (error) {
    logger.error('Error ending trivia:', error);
    return 'Error ending trivia game.';
  }
}

export function listCategories() {
  const categoryList = Object.keys(categories).join(', ');
  return `Available trivia categories: ${categoryList}`;
}

export default {
  startTrivia,
  handleTriviaAnswer,
  endTrivia,
  listCategories,
};
