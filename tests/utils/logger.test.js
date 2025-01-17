import winston from 'winston';
import logger from '../../utils/logger.js';

describe('Logger Utility', () => {
  test('should create a logger instance', () => {
    expect(logger).toBeInstanceOf(winston.Logger);
  });

  test('should have correct log levels', () => {
    expect(logger.levels).toEqual({
      error: 0,
      warn: 1,
      info: 2,
      http: 3,
      verbose: 4,
      debug: 5,
      silly: 6
    });
  });

  test('should have correct default level', () => {
    expect(logger.level).toBe('info');
  });
});
