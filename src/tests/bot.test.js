import logger from '../utils/logger.js';

jest.mock('tmi.js');
jest.mock('@ai-sdk/perplexity', () => ({
  perplexity: jest.fn().mockReturnValue('mocked-model')
}));

jest.mock('ai', () => ({
  generateText: jest.fn().mockImplementation(({ messages }) => {
    // Return different responses based on the type of request
    if (messages[0].content.includes('content moderator')) {
      return Promise.resolve({
        text: JSON.stringify({
          toxicityScore: 0.5,
          flagged: false,
          categories: {}
        })
      });
    }
    return Promise.resolve({
      text: 'Mocked response'
    });
  })
}));

jest.mock('../utils/logger.js', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('Bot functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should log errors properly', () => {
    const error = new Error('Test error');
    logger.error('Test error message', error);
    expect(logger.error).toHaveBeenCalledWith('Test error message', error);
  });
});
