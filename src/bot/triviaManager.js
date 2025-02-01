import logger from '../utils/logger.js';
import { getRandomQuestion, categories } from '../utils/trivia.js';

// Store trivia state in memory
const triviaState = {
  isActive: false,
  currentQuestion: null,
  answers: [],
  participants: new Map(), // username -> {points, lastAnswer}
  timeoutId: null,
  settings: {
    questionDuration: 30, // seconds
    pointsPerQuestion: 100,
    bonusPoints: 50, // for first correct answer
  },
};

export async function startTrivia(channel, category = 'general') {
  try {
    if (triviaState.isActive) {
      return 'A trivia game is already in progress!';
    }

    // Validate category
    if (!categories[category]) {
      return `Invalid category. Available categories: ${Object.keys(categories).join(', ')}`;
    }

    // Get question from trivia module
    const questionData = await getRandomQuestion(category);
    if (!questionData) {
      return 'Failed to generate trivia question. Please try again.';
    }

    // Set up the game state
    triviaState.isActive = true;
    triviaState.currentQuestion = {
      question: questionData.question,
      answers: questionData.answers,
      correctAnswer: questionData.correct,
      startTime: Date.now(),
    };
    triviaState.answers = [];

    // Set timeout to end question
    triviaState.timeoutId = setTimeout(() => {
      endQuestion(channel);
    }, triviaState.settings.questionDuration * 1000);

    // Format the question for chat
    const formattedQuestion = `
      🎯 TRIVIA TIME! (${triviaState.settings.questionDuration}s)
      ${questionData.question}
      A: ${questionData.answers[0]}
      B: ${questionData.answers[1]}
      C: ${questionData.answers[2]}
      D: ${questionData.answers[3]}
      Type !answer [A/B/C/D] to submit your answer!
    `.replace(/\n\s+/g, '\n');

    logger.info('Trivia started:', {
      category,
      question: questionData.question,
    });
    return formattedQuestion;
  } catch (error) {
    logger.error('Error starting trivia:', error);
    return 'Failed to start trivia game. Please try again.';
  }
}

export async function handleAnswer(channel, username, answer) {
  try {
    if (!triviaState.isActive || !triviaState.currentQuestion) {
      return null;
    }

    // Validate answer format
    const validAnswer = answer.toUpperCase().trim();
    if (!['A', 'B', 'C', 'D'].includes(validAnswer)) {
      return 'Please answer with A, B, C, or D';
    }

    // Check if user already answered
    if (triviaState.answers.some((a) => a.username === username)) {
      return null;
    }

    // Record answer
    triviaState.answers.push({
      username,
      answer: validAnswer,
      timestamp: Date.now(),
    });

    // If this is the last answer needed, end early
    if (triviaState.answers.length >= 10) {
      // End after 10 answers
      clearTimeout(triviaState.timeoutId);
      endQuestion(channel);
    }

    return null;
  } catch (error) {
    logger.error('Error handling trivia answer:', error);
    return 'Error processing answer. Please try again.';
  }
}

function endQuestion(channel) {
  if (!triviaState.isActive || !triviaState.currentQuestion) {
    return 'No trivia game in progress';
  }

  const { correctAnswer } = triviaState.currentQuestion;
  const correctAnswers = triviaState.answers
    .filter((a) => a.answer === correctAnswer)
    .sort((a, b) => a.timestamp - b.timestamp);

  // Award points
  correctAnswers.forEach((answer, index) => {
    const currentPoints =
      triviaState.participants.get(answer.username)?.points || 0;
    const points =
      index === 0
        ? triviaState.settings.pointsPerQuestion +
          triviaState.settings.bonusPoints
        : triviaState.settings.pointsPerQuestion;

    triviaState.participants.set(answer.username, {
      points: currentPoints + points,
      lastAnswer: Date.now(),
    });
  });

  // Generate results message
  let results = `Time's up! The correct answer was ${correctAnswer}: ${
    triviaState.currentQuestion.answers[correctAnswer.charCodeAt(0) - 65]
  }`;

  if (correctAnswers.length > 0) {
    const winners = correctAnswers
      .map(
        (a, i) =>
          `${a.username} (${i === 0 ? triviaState.settings.pointsPerQuestion + triviaState.settings.bonusPoints : triviaState.settings.pointsPerQuestion} pts)`
      )
      .join(', ');
    results += `\nCorrect answers: ${winners}`;
  } else {
    results += '\nNo one got it right!';
  }

  // Reset state
  triviaState.isActive = false;
  triviaState.currentQuestion = null;
  triviaState.answers = [];
  triviaState.timeoutId = null;

  return results;
}

export async function endTrivia(channel) {
  try {
    if (!triviaState.participants.size) {
      return 'No trivia game has been played yet!';
    }

    // Get final standings
    const standings = Array.from(triviaState.participants.entries())
      .sort((a, b) => b[1].points - a[1].points)
      .slice(0, 3)
      .map(
        (entry, index) => `${index + 1}. ${entry[0]} (${entry[1].points} pts)`
      );

    // Reset all state
    triviaState.isActive = false;
    triviaState.currentQuestion = null;
    triviaState.answers = [];
    triviaState.participants.clear();
    triviaState.timeoutId = null;

    return `🏆 Trivia Game Ended!\n${standings.join('\n')}`;
  } catch (error) {
    logger.error('Error ending trivia:', error);
    return 'Error ending trivia game';
  }
}

export default {
  startTrivia,
  handleAnswer,
  endTrivia,
};
