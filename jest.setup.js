import { TextEncoder, TextDecoder } from 'util';
import { jest } from '@jest/globals';
import events from 'events';
const { EventEmitter } = events;

// Setup TextEncoder/Decoder for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock environment variables
process.env = {
  ...process.env,
  TWITCH_BOT_USERNAME: 'FirePigBot',
  TWITCH_CHANNEL: 'testchannel',
  TWITCH_BOT_CLIENT_ID: 'test_client_id',
  TWITCH_BOT_CLIENT_SECRET: 'test_client_secret',
  TWITCH_BOT_ACCESS_TOKEN: 'test_access_token',
  TWITCH_BOT_REFRESH_TOKEN: 'test_refresh_token',
  PERPLEXITY_API_KEY: 'test_perplexity_key',
  SPOTIFY_CLIENT_ID: 'test_spotify_client_id',
  SPOTIFY_CLIENT_SECRET: 'test_spotify_client_secret',
  SPOTIFY_REDIRECT_URI: 'http://localhost:3000/callback',
  NODE_ENV: 'test',
  LOG_LEVEL: 'info'
};

// Mock WebSocket
global.WebSocket = class MockWebSocket {
  constructor() {
    setTimeout(() => {
      if (this.onopen) this.onopen();
    });
  }
  on() { }
  send() { }
  close() { }
};

// Mock timers
jest.useFakeTimers();

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve('')
  })
);

// Suppress console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Create mock stream class
class MockStream extends EventEmitter {
  constructor() {
    super();
    this.write = jest.fn();
    this.end = jest.fn();
    this.close = jest.fn();
  }
}

// Create mock modules
const mockFs = {
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(() => '{}'),
  writeFileSync: jest.fn(),
  createWriteStream: jest.fn(() => new MockStream()),
  createReadStream: jest.fn(() => new MockStream()),
  stat: jest.fn((path, callback) => callback(null, {
    isFile: () => true,
    isDirectory: () => false,
    size: 0,
    mtime: new Date()
  })),
  open: jest.fn((path, flags, callback) => callback(null, 1)),
  close: jest.fn((fd, callback) => callback(null)),
  unlink: jest.fn((path, callback) => callback(null))
};

const mockPath = {
  join: jest.fn((...args) => args.join('/')),
  dirname: jest.fn((p) => p.split('/').slice(0, -1).join('/')),
  basename: jest.fn((p) => p.split('/').pop()),
  extname: jest.fn((p) => p.slice(p.lastIndexOf('.'))),
  resolve: jest.fn((...args) => args.join('/'))
};

const mockDotenv = {
  config: jest.fn(),
  parse: jest.fn()
};

// Export mocks for use in tests
export const mocks = {
  fs: mockFs,
  path: mockPath,
  dotenv: mockDotenv
};

// Setup default timeout
jest.setTimeout(10000);
