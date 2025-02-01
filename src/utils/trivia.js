const questions = [
  {
    question: 'What is the capital of France?',
    answer: 'Paris',
    category: 'Geography',
  },
  {
    question: 'Who painted the Mona Lisa?',
    answer: 'Leonardo da Vinci',
    category: 'Art',
  },
  {
    question: 'What is the chemical symbol for water?',
    answer: 'H2O',
    category: 'Science',
  },
  {
    question: 'How many continents are there?',
    answer: '7',
    category: 'Geography',
  },
  {
    question: 'What is the largest planet in our solar system?',
    answer: 'Jupiter',
    category: 'Astronomy',
  },
];

export function getRandomQuestion() {
  return questions[Math.floor(Math.random() * questions.length)];
}
