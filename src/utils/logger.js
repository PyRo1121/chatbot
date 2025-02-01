import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'src', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ level, message, timestamp, stack }) => {
          const ts = new Date(timestamp).toLocaleTimeString();
          if (stack) {
            return `${ts} ${level}: ${message}\n${stack}`;
          }
          if (typeof message === 'object') {
            return `${ts} ${level}: ${JSON.stringify(message, null, 2)}`;
          }
          return `${ts} ${level}: ${message}`;
        })
      ),
      handleExceptions: true,
      handleRejections: true,
    }),
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true,
      handleExceptions: true,
      handleRejections: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
  ],
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Add error event handlers to prevent crashes on file write errors
logger.transports.forEach((transport) => {
  transport.on('error', (error) => {
    console.error('Logger transport error:', error);
  });
});

// Add helper methods for common logging patterns
logger.startupMessage = (message) => {
  const separator = '='.repeat(50);
  console.log(separator);
  logger.info(message);
  console.log(separator);
};

logger.sectionHeader = (message) => {
  const separator = '-'.repeat(20);
  console.log(separator);
  logger.info(message);
  console.log(separator);
};

logger.debugObject = (label, obj) => {
  logger.debug(`${label}:`, {
    data: obj,
    timestamp: new Date().toISOString(),
  });
};

// Test logger configuration
logger.debug(`Logger initialized with level: ${logger.level}`);

export default logger;
