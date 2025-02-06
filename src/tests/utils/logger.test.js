import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import winston from 'winston';
import path from 'node:path';

// Test constants
const TEST_MESSAGE = 'Test message';
const TEST_OBJECT = { key: 'value' };
const TEST_ERROR = new Error('Test error');

describe('Logger Utility', () => {
  let consoleTransport;
  let fileTransport;

  beforeEach(() => {
    // Mock transports
    consoleTransport = {
      on: jest.fn(),
      log: jest.fn(),
    };
    fileTransport = {
      on: jest.fn(),
      log: jest.fn(),
    };

    // Spy on winston methods
    jest.spyOn(winston.transports, 'Console').mockImplementation(() => consoleTransport);
    jest.spyOn(winston.transports, 'File').mockImplementation(() => fileTransport);
    jest.spyOn(logger, 'info');
    jest.spyOn(logger, 'error');
    jest.spyOn(logger, 'debug');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Logger Instance', () => {
    test('should create a valid logger instance', () => {
      expect(logger).toBeInstanceOf(winston.Logger);
      expect(logger.levels).toEqual(winston.config.npm.levels);
    });

    test('should have correct default configuration', () => {
      expect(logger.level).toBe(process.env.LOG_LEVEL || 'info');
      expect(logger.exitOnError).toBe(false);
    });
  });

  describe('Log Levels', () => {
    const levels = ['error', 'warn', 'info', 'debug'];

    test.each(levels)('should have %s log level method', (level) => {
      expect(typeof logger[level]).toBe('function');
    });

    test('should respect log level hierarchy', () => {
      logger.level = 'warn';
      logger.warn(TEST_MESSAGE);
      logger.info(TEST_MESSAGE);

      expect(logger.warn).toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe('Helper Methods', () => {
    test('startupMessage should format correctly', () => {
      const message = 'Application Starting';
      logger.startupMessage(message);

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('=========='));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(message));
    });

    test('sectionHeader should add proper formatting', () => {
      const section = 'Test Section';
      logger.sectionHeader(section);

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('---------'));
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining(section));
    });

    test('debugObject should properly format objects', () => {
      logger.debugObject('test', TEST_OBJECT);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('test'),
        expect.objectContaining(TEST_OBJECT)
      );
    });
  });

  describe('Error Handling', () => {
    test('should properly log errors with stack traces', () => {
      logger.error(TEST_ERROR);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(TEST_ERROR.message),
        expect.objectContaining({ stack: TEST_ERROR.stack })
      );
    });

    test('should handle non-Error objects in error logging', () => {
      const stringError = 'String error message';
      logger.error(stringError);

      expect(logger.error).toHaveBeenCalledWith(stringError);
    });
  });

  describe('Performance', () => {
    test('should handle high volume logging', () => {
      const iterations = 1000;
      const startTime = process.hrtime();

      for (let i = 0; i < iterations; i++) {
        logger.info(`Test message ${i}`);
      }

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const totalTime = seconds * 1000 + nanoseconds / 1000000;

      expect(totalTime).toBeLessThan(1000); // Should complete under 1 second
    });
  });

  describe('Debug Mode', () => {
    test('should respect debug mode setting', () => {
      const originalLevel = logger.level;
      logger.level = 'debug';

      logger.debug(TEST_MESSAGE);
      expect(logger.debug).toHaveBeenCalledWith(TEST_MESSAGE);

      logger.level = originalLevel;
    });
  });
});
