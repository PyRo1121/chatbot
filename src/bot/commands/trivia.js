import { getRandomQuestion } from '../../utils/trivia.js';

let currentGame = null;

export async function startTrivia(client, channel) {
  if (currentGame) {
    return 'A trivia game is already in progress!';
  }

  currentGame = {
    question: await getRandomQuestion(),
    active: true,
    attempts: 0,
    correctAnswer: null,
  };

  return `🎲 Trivia Time! ${currentGame.question.question} (Type your answer in chat!)`;
}

export async function handleTriviaAnswer(client, channel, user, answer) {
  if (!currentGame || !currentGame.active) {
    return null;
  }

  currentGame.attempts++;

  if (answer.toLowerCase() === currentGame.question.answer.toLowerCase()) {
    currentGame.active = false;
    currentGame.correctAnswer = user.username;
    return `🎉 @${user.username} got it right! The answer was: ${currentGame.question.answer}`;
  }

  if (currentGame.attempts >= 3) {
    currentGame.active = false;
    return `😢 No one got it! The correct answer was: ${currentGame.question.answer}`;
  }

  return null;
}

export function endTrivia() {
  if (!currentGame) {
    return 'No trivia game is currently running!';
  }

  currentGame = null;
  return 'Trivia game ended!';
}
